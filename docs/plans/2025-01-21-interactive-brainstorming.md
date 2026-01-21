# Interactive Brainstorming Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an interactive chat-based brainstorming experience where AI asks multiple-choice questions, analyzes the repository, and refines requirements through conversation before generating a plan.

**Architecture:** A slide-over panel opens from the right when user starts brainstorming. The AI performs a quick repo scan, then engages in a multi-turn conversation with multiple-choice questions. Conversation state is held in server memory (not persisted). When AI detects clear requirements, it suggests completion. User confirms, final result saves to DB, conversation discards.

**Tech Stack:** Next.js 15 App Router, React 19, Vitest, existing AIClient abstraction, Radix UI for panel

---

## Task 1: Create Brainstorm Chat Types

**Files:**
- Create: `lib/ai/brainstorm-chat.ts`

**Step 1: Create the types file**

```typescript
// lib/ai/brainstorm-chat.ts
import type { AIClient, ChatMessage } from "./client";

export interface BrainstormOption {
  label: string;
  value: string;
}

export interface BrainstormChatResponse {
  message: string;
  options?: BrainstormOption[];
  brainstormPreview?: {
    summary: string;
    requirements: string[];
    considerations: string[];
    suggestedApproach: string;
  };
  suggestComplete?: boolean;
}

export interface RepoContext {
  techStack: string[];
  fileStructure: string[];
  configFiles: string[];
  relevantCode?: Record<string, string>;
}

export interface BrainstormConversation {
  taskId: string;
  messages: ChatMessage[];
  repoContext: RepoContext;
  currentPreview?: BrainstormChatResponse["brainstormPreview"];
}

// In-memory store for active conversations (not persisted)
const activeConversations = new Map<string, BrainstormConversation>();

export function getConversation(taskId: string): BrainstormConversation | undefined {
  return activeConversations.get(taskId);
}

export function setConversation(taskId: string, conversation: BrainstormConversation): void {
  activeConversations.set(taskId, conversation);
}

export function deleteConversation(taskId: string): void {
  activeConversations.delete(taskId);
}
```

**Step 2: Verify file exists and has no syntax errors**

Run: `npx tsc --noEmit lib/ai/brainstorm-chat.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add lib/ai/brainstorm-chat.ts
git commit -m "feat: add brainstorm chat types and in-memory store"
```

---

## Task 2: Create Repository Scanner

**Files:**
- Modify: `lib/ai/brainstorm-chat.ts`

**Step 1: Add repo scanning function**

Add after the existing code in `lib/ai/brainstorm-chat.ts`:

```typescript
import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

// Quick scan for repo context
export async function scanRepository(repoPath: string): Promise<RepoContext> {
  const techStack: string[] = [];
  const fileStructure: string[] = [];
  const configFiles: string[] = [];

  try {
    // Read top-level directory
    const entries = await readdir(repoPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        fileStructure.push(`${entry.name}/`);
      } else if (entry.isFile()) {
        fileStructure.push(entry.name);
      }
    }

    // Check for common config files to detect tech stack
    const configChecks = [
      { file: "package.json", tech: "Node.js" },
      { file: "tsconfig.json", tech: "TypeScript" },
      { file: "next.config.ts", tech: "Next.js" },
      { file: "next.config.js", tech: "Next.js" },
      { file: "tailwind.config.ts", tech: "Tailwind CSS" },
      { file: "tailwind.config.js", tech: "Tailwind CSS" },
      { file: "drizzle.config.ts", tech: "Drizzle ORM" },
      { file: "Cargo.toml", tech: "Rust" },
      { file: "pyproject.toml", tech: "Python" },
      { file: "go.mod", tech: "Go" },
    ];

    for (const check of configChecks) {
      try {
        await stat(join(repoPath, check.file));
        techStack.push(check.tech);
        configFiles.push(check.file);
      } catch {
        // File doesn't exist, skip
      }
    }

    // Read package.json for more details if it exists
    try {
      const pkgContent = await readFile(join(repoPath, "package.json"), "utf-8");
      const pkg = JSON.parse(pkgContent);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps["react"]) techStack.push("React");
      if (deps["drizzle-orm"]) techStack.push("Drizzle ORM");
      if (deps["next-auth"]) techStack.push("NextAuth");
      if (deps["stripe"]) techStack.push("Stripe");
    } catch {
      // No package.json or invalid
    }

  } catch (error) {
    console.error("Error scanning repository:", error);
  }

  return {
    techStack: [...new Set(techStack)], // Dedupe
    fileStructure: fileStructure.slice(0, 20), // Limit to 20 entries
    configFiles,
  };
}
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit lib/ai/brainstorm-chat.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add lib/ai/brainstorm-chat.ts
git commit -m "feat: add repository scanner for brainstorm context"
```

---

## Task 3: Create AI Chat Function

**Files:**
- Modify: `lib/ai/brainstorm-chat.ts`

**Step 1: Add the chat function**

Add after `scanRepository` in `lib/ai/brainstorm-chat.ts`:

```typescript
const SYSTEM_PROMPT = `You are a senior software engineer helping to brainstorm a coding task through conversation.

Your job is to:
1. Understand what the user wants to build
2. Ask clarifying questions (2-4 options each, multiple-choice style)
3. Consider the repository context provided
4. Build up a clear picture of requirements

RESPONSE FORMAT (JSON only):
{
  "message": "Your conversational response explaining your thinking",
  "options": [
    { "label": "Option 1 text", "value": "option1" },
    { "label": "Option 2 text", "value": "option2" }
  ],
  "brainstormPreview": {
    "summary": "Current understanding of the task",
    "requirements": ["req1", "req2"],
    "considerations": ["consideration1"],
    "suggestedApproach": "Current thinking on approach"
  },
  "suggestComplete": false
}

RULES:
- Always include 2-4 options when asking a question
- Update brainstormPreview as understanding grows
- Set suggestComplete=true when requirements are clear and you're ready to finalize
- When suggestComplete=true, message should ask "Ready to generate the implementation plan?"
- Keep messages concise but friendly
- Reference specific tech from repo context when relevant

Respond ONLY with valid JSON, no markdown or extra text.`;

export async function chatWithAI(
  client: AIClient,
  conversation: BrainstormConversation,
  userMessage: string
): Promise<BrainstormChatResponse> {
  // Build context message
  const contextMsg = `Repository Context:
- Tech Stack: ${conversation.repoContext.techStack.join(", ") || "Unknown"}
- Structure: ${conversation.repoContext.fileStructure.join(", ")}
- Config Files: ${conversation.repoContext.configFiles.join(", ")}`;

  // Build messages array
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: contextMsg },
    ...conversation.messages,
    { role: "user", content: userMessage },
  ];

  const response = await client.chat(messages, { maxTokens: 2048 });

  // Strip markdown code blocks if present
  let cleanedResponse = response.trim();
  const jsonMatch = cleanedResponse.match(/^```json\s*([\s\S]*?)\s*```$/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[1].trim();
  } else if (cleanedResponse.startsWith("```")) {
    cleanedResponse = cleanedResponse.slice(3);
    if (cleanedResponse.endsWith("```")) {
      cleanedResponse = cleanedResponse.slice(0, -3);
    }
    cleanedResponse = cleanedResponse.trim();
  }

  try {
    const parsed = JSON.parse(cleanedResponse) as BrainstormChatResponse;
    return parsed;
  } catch {
    // Fallback if JSON parsing fails
    return {
      message: cleanedResponse || "I had trouble processing that. Could you try rephrasing?",
      suggestComplete: false,
    };
  }
}

export async function initializeBrainstorm(
  client: AIClient,
  taskTitle: string,
  taskDescription: string | null,
  repoContext: RepoContext
): Promise<BrainstormChatResponse> {
  const initialPrompt = `New brainstorming session started.

Task Title: ${taskTitle}
${taskDescription ? `Task Description: ${taskDescription}` : "No description provided."}

Repository Context:
- Tech Stack: ${repoContext.techStack.join(", ") || "Unknown"}
- File Structure: ${repoContext.fileStructure.join(", ")}

Please introduce yourself briefly, acknowledge the task, and ask your first clarifying question with multiple-choice options.`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: initialPrompt },
  ];

  const response = await client.chat(messages, { maxTokens: 2048 });

  // Strip markdown code blocks
  let cleanedResponse = response.trim();
  const jsonMatch = cleanedResponse.match(/^```json\s*([\s\S]*?)\s*```$/);
  if (jsonMatch) {
    cleanedResponse = jsonMatch[1].trim();
  }

  try {
    return JSON.parse(cleanedResponse) as BrainstormChatResponse;
  } catch {
    return {
      message: "Let's brainstorm this task together. What's the main goal you're trying to achieve?",
      options: [
        { label: "Add a new feature", value: "new_feature" },
        { label: "Fix a bug", value: "bug_fix" },
        { label: "Refactor existing code", value: "refactor" },
        { label: "Something else", value: "other" },
      ],
      suggestComplete: false,
    };
  }
}
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit lib/ai/brainstorm-chat.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add lib/ai/brainstorm-chat.ts
git commit -m "feat: add AI chat functions for interactive brainstorming"
```

---

## Task 4: Export from AI Index

**Files:**
- Modify: `lib/ai/index.ts`

**Step 1: Add exports**

Replace contents of `lib/ai/index.ts`:

```typescript
export { brainstormTask, type BrainstormResult } from "./brainstorm";
export { generatePlan, type PlanResult } from "./plan";
export { createAIClient, getDefaultModel, type AIClient, type ChatMessage, type ChatOptions } from "./client";
export {
  type BrainstormOption,
  type BrainstormChatResponse,
  type RepoContext,
  type BrainstormConversation,
  getConversation,
  setConversation,
  deleteConversation,
  scanRepository,
  chatWithAI,
  initializeBrainstorm,
} from "./brainstorm-chat";
```

**Step 2: Verify exports work**

Run: `npx tsc --noEmit lib/ai/index.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add lib/ai/index.ts
git commit -m "feat: export brainstorm chat functions from AI index"
```

---

## Task 5: Create Init API Route

**Files:**
- Create: `app/api/tasks/[taskId]/brainstorm/init/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/tasks/[taskId]/brainstorm/init/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users, repos } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createAIClient,
  getDefaultModel,
  scanRepository,
  initializeBrainstorm,
  setConversation,
  type RepoContext,
} from "@/lib/ai";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";

function getProviderApiKey(
  user: User,
  provider: AiProvider
): { encrypted: string; iv: string } | null {
  switch (provider) {
    case "anthropic":
      return user.encryptedApiKey && user.apiKeyIv
        ? { encrypted: user.encryptedApiKey, iv: user.apiKeyIv }
        : null;
    case "openai":
      return user.openaiEncryptedApiKey && user.openaiApiKeyIv
        ? { encrypted: user.openaiEncryptedApiKey, iv: user.openaiApiKeyIv }
        : null;
    case "gemini":
      return user.geminiEncryptedApiKey && user.geminiApiKeyIv
        ? { encrypted: user.geminiEncryptedApiKey, iv: user.geminiApiKeyIv }
        : null;
    default:
      return null;
  }
}

function getPreferredModel(user: User, provider: AiProvider): string {
  switch (provider) {
    case "anthropic":
      return user.preferredAnthropicModel || getDefaultModel("anthropic");
    case "openai":
      return user.preferredOpenaiModel || getDefaultModel("openai");
    case "gemini":
      return user.preferredGeminiModel || getDefaultModel("gemini");
    default:
      return getDefaultModel("anthropic");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find configured provider
  const providers: AiProvider[] = ["anthropic", "openai", "gemini"];
  let aiProvider: AiProvider | null = null;

  if (user.preferredProvider && getProviderApiKey(user, user.preferredProvider)) {
    aiProvider = user.preferredProvider;
  } else {
    for (const provider of providers) {
      if (getProviderApiKey(user, provider)) {
        aiProvider = provider;
        break;
      }
    }
  }

  if (!aiProvider) {
    return NextResponse.json(
      { error: "No AI provider configured. Please add an API key in Settings." },
      { status: 400 }
    );
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return NextResponse.json(
      { error: `API key not configured for ${aiProvider}` },
      { status: 400 }
    );
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);
    const model = getPreferredModel(user, aiProvider);
    const client = createAIClient(aiProvider, apiKey, model);

    // Scan repository (use repo path if available, otherwise mock)
    let repoContext: RepoContext = {
      techStack: ["Next.js", "React", "TypeScript", "Drizzle ORM"],
      fileStructure: ["app/", "components/", "lib/", "public/"],
      configFiles: ["package.json", "tsconfig.json", "next.config.ts"],
    };

    // If repo has a local path, scan it
    if (task.repo.localPath) {
      try {
        repoContext = await scanRepository(task.repo.localPath);
      } catch (error) {
        console.error("Error scanning repo:", error);
        // Use default context on error
      }
    }

    // Initialize conversation with AI
    const initialResponse = await initializeBrainstorm(
      client,
      task.title,
      task.description,
      repoContext
    );

    // Store conversation in memory
    setConversation(taskId, {
      taskId,
      messages: [
        { role: "assistant", content: JSON.stringify(initialResponse) },
      ],
      repoContext,
      currentPreview: initialResponse.brainstormPreview,
    });

    // Update task status
    await db
      .update(tasks)
      .set({ status: "brainstorming", updatedAt: new Date() })
      .where(eq(tasks.id, taskId));

    return NextResponse.json({
      message: initialResponse.message,
      options: initialResponse.options,
      brainstormPreview: initialResponse.brainstormPreview,
      repoContext: {
        techStack: repoContext.techStack,
        fileStructure: repoContext.fileStructure,
      },
    });
  } catch (error) {
    console.error("Brainstorm init error:", error);
    return NextResponse.json(
      { error: "Failed to start brainstorming. Please try again." },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit app/api/tasks/[taskId]/brainstorm/init/route.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add app/api/tasks/[taskId]/brainstorm/init/route.ts
git commit -m "feat: add brainstorm init API route"
```

---

## Task 6: Create Chat API Route

**Files:**
- Create: `app/api/tasks/[taskId]/brainstorm/chat/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/tasks/[taskId]/brainstorm/chat/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
  createAIClient,
  getDefaultModel,
  getConversation,
  setConversation,
  chatWithAI,
} from "@/lib/ai";
import { decryptApiKey } from "@/lib/crypto";
import type { AiProvider, User } from "@/lib/db/schema";

function getProviderApiKey(
  user: User,
  provider: AiProvider
): { encrypted: string; iv: string } | null {
  switch (provider) {
    case "anthropic":
      return user.encryptedApiKey && user.apiKeyIv
        ? { encrypted: user.encryptedApiKey, iv: user.apiKeyIv }
        : null;
    case "openai":
      return user.openaiEncryptedApiKey && user.openaiApiKeyIv
        ? { encrypted: user.openaiEncryptedApiKey, iv: user.openaiApiKeyIv }
        : null;
    case "gemini":
      return user.geminiEncryptedApiKey && user.geminiApiKeyIv
        ? { encrypted: user.geminiEncryptedApiKey, iv: user.geminiApiKeyIv }
        : null;
    default:
      return null;
  }
}

function getPreferredModel(user: User, provider: AiProvider): string {
  switch (provider) {
    case "anthropic":
      return user.preferredAnthropicModel || getDefaultModel("anthropic");
    case "openai":
      return user.preferredOpenaiModel || getDefaultModel("openai");
    case "gemini":
      return user.preferredGeminiModel || getDefaultModel("gemini");
    default:
      return getDefaultModel("anthropic");
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse request body
  const body = await request.json();
  const { message, choice } = body as { message?: string; choice?: string };

  if (!message && !choice) {
    return NextResponse.json(
      { error: "Message or choice is required" },
      { status: 400 }
    );
  }

  // Get existing conversation
  const conversation = getConversation(taskId);
  if (!conversation) {
    return NextResponse.json(
      { error: "No active brainstorm session. Please start a new one." },
      { status: 400 }
    );
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get user
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Find configured provider
  const providers: AiProvider[] = ["anthropic", "openai", "gemini"];
  let aiProvider: AiProvider | null = null;

  if (user.preferredProvider && getProviderApiKey(user, user.preferredProvider)) {
    aiProvider = user.preferredProvider;
  } else {
    for (const provider of providers) {
      if (getProviderApiKey(user, provider)) {
        aiProvider = provider;
        break;
      }
    }
  }

  if (!aiProvider) {
    return NextResponse.json(
      { error: "No AI provider configured" },
      { status: 400 }
    );
  }

  const encryptedKey = getProviderApiKey(user, aiProvider);
  if (!encryptedKey) {
    return NextResponse.json(
      { error: `API key not configured for ${aiProvider}` },
      { status: 400 }
    );
  }

  try {
    const apiKey = decryptApiKey(encryptedKey);
    const model = getPreferredModel(user, aiProvider);
    const client = createAIClient(aiProvider, apiKey, model);

    // Build user message
    const userMessage = choice
      ? `I choose: ${choice}`
      : message || "";

    // Add user message to conversation
    conversation.messages.push({ role: "user", content: userMessage });

    // Get AI response
    const response = await chatWithAI(client, conversation, userMessage);

    // Add AI response to conversation
    conversation.messages.push({
      role: "assistant",
      content: JSON.stringify(response),
    });

    // Update preview if provided
    if (response.brainstormPreview) {
      conversation.currentPreview = response.brainstormPreview;
    }

    // Save updated conversation
    setConversation(taskId, conversation);

    return NextResponse.json({
      message: response.message,
      options: response.options,
      brainstormPreview: response.brainstormPreview,
      suggestComplete: response.suggestComplete,
    });
  } catch (error) {
    console.error("Brainstorm chat error:", error);
    return NextResponse.json(
      { error: "Failed to process message. Please try again." },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit app/api/tasks/[taskId]/brainstorm/chat/route.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add app/api/tasks/[taskId]/brainstorm/chat/route.ts
git commit -m "feat: add brainstorm chat API route"
```

---

## Task 7: Create Finalize API Route

**Files:**
- Create: `app/api/tasks/[taskId]/brainstorm/finalize/route.ts`

**Step 1: Create the route file**

```typescript
// app/api/tasks/[taskId]/brainstorm/finalize/route.ts
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, tasks } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getConversation, deleteConversation } from "@/lib/ai";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const { taskId } = await params;

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get task with repo to verify ownership
  const task = await db.query.tasks.findFirst({
    where: eq(tasks.id, taskId),
    with: { repo: true },
  });

  if (!task || task.repo.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Get conversation
  const conversation = getConversation(taskId);
  if (!conversation || !conversation.currentPreview) {
    return NextResponse.json(
      { error: "No brainstorm result to finalize" },
      { status: 400 }
    );
  }

  try {
    // Save final brainstorm result
    const brainstormResult = conversation.currentPreview;

    await db
      .update(tasks)
      .set({
        brainstormResult: JSON.stringify(brainstormResult, null, 2),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));

    // Delete conversation from memory
    deleteConversation(taskId);

    // Get updated task
    const updatedTask = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error("Brainstorm finalize error:", error);
    return NextResponse.json(
      { error: "Failed to finalize brainstorm. Please try again." },
      { status: 500 }
    );
  }
}
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit app/api/tasks/[taskId]/brainstorm/finalize/route.ts 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add app/api/tasks/[taskId]/brainstorm/finalize/route.ts
git commit -m "feat: add brainstorm finalize API route"
```

---

## Task 8: Create Brainstorm Panel Component

**Files:**
- Create: `components/brainstorm-panel.tsx`

**Step 1: Create the panel component**

```typescript
// components/brainstorm-panel.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  X,
  Send,
  Loader2,
  Sparkles,
  CheckCircle2,
  Code,
  FileText,
} from "lucide-react";

interface BrainstormOption {
  label: string;
  value: string;
}

interface BrainstormPreview {
  summary: string;
  requirements: string[];
  considerations: string[];
  suggestedApproach: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  options?: BrainstormOption[];
  preview?: BrainstormPreview;
  suggestComplete?: boolean;
}

interface BrainstormPanelProps {
  taskId: string;
  taskTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onFinalize: () => void;
}

export function BrainstormPanel({
  taskId,
  taskTitle,
  isOpen,
  onClose,
  onFinalize,
}: BrainstormPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [currentPreview, setCurrentPreview] = useState<BrainstormPreview | null>(null);
  const [suggestComplete, setSuggestComplete] = useState(false);
  const [repoContext, setRepoContext] = useState<{ techStack: string[]; fileStructure: string[] } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize conversation when panel opens
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeConversation();
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when not loading
  useEffect(() => {
    if (!loading && !initializing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading, initializing]);

  const initializeConversation = async () => {
    setInitializing(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/init`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setMessages([
          {
            role: "assistant",
            content: data.message,
            options: data.options,
            preview: data.brainstormPreview,
          },
        ]);
        if (data.brainstormPreview) {
          setCurrentPreview(data.brainstormPreview);
        }
        if (data.repoContext) {
          setRepoContext(data.repoContext);
        }
      } else {
        const error = await res.json();
        setMessages([
          {
            role: "assistant",
            content: error.error || "Failed to start brainstorming. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Init error:", error);
      setMessages([
        {
          role: "assistant",
          content: "Connection error. Please check your internet and try again.",
        },
      ]);
    } finally {
      setInitializing(false);
    }
  };

  const sendMessage = async (content: string, isChoice = false) => {
    if (!content.trim() && !isChoice) return;

    setLoading(true);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");

    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isChoice ? { choice: content } : { message: content }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.message,
            options: data.options,
            preview: data.brainstormPreview,
            suggestComplete: data.suggestComplete,
          },
        ]);
        if (data.brainstormPreview) {
          setCurrentPreview(data.brainstormPreview);
        }
        if (data.suggestComplete) {
          setSuggestComplete(true);
        }
      } else {
        const error = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: error.error || "Something went wrong. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Connection error. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFinalize = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/brainstorm/finalize`, {
        method: "POST",
      });

      if (res.ok) {
        onFinalize();
        onClose();
      } else {
        const error = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: error.error || "Failed to finalize. Please try again.",
          },
        ]);
      }
    } catch (error) {
      console.error("Finalize error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 lg:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full sm:w-[400px] bg-card border-l shadow-xl z-50",
          "flex flex-col",
          "animate-in slide-in-from-right duration-300"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0" />
            <h2 className="font-semibold truncate">Brainstorm: {taskTitle}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -m-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Repo Context Badge */}
        {repoContext && (
          <div className="px-4 py-2 bg-muted/50 border-b text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Code className="w-3 h-3" />
              <span>{repoContext.techStack.slice(0, 3).join(", ")}</span>
              {repoContext.techStack.length > 3 && (
                <span>+{repoContext.techStack.length - 3} more</span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {initializing ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex flex-col gap-2",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Options */}
                {msg.role === "assistant" && msg.options && msg.options.length > 0 && (
                  <div className="flex flex-col gap-1.5 w-full max-w-[85%]">
                    {msg.options.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => sendMessage(opt.label, true)}
                        disabled={loading || i !== messages.length - 1}
                        className={cn(
                          "text-left px-3 py-2 rounded-lg text-sm border transition-colors",
                          i === messages.length - 1
                            ? "hover:bg-muted/80 hover:border-primary/50 cursor-pointer"
                            : "opacity-50 cursor-not-allowed",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Suggest Complete */}
                {msg.role === "assistant" && msg.suggestComplete && i === messages.length - 1 && (
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      onClick={handleFinalize}
                      disabled={loading}
                      className="gap-1.5"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Yes, Generate Plan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendMessage("I'd like to continue refining")}
                      disabled={loading}
                    >
                      Keep Refining
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Preview (collapsible) */}
        {currentPreview && (
          <div className="border-t">
            <details className="group">
              <summary className="flex items-center gap-2 px-4 py-2 text-sm font-medium cursor-pointer hover:bg-muted/50">
                <FileText className="w-4 h-4 text-violet-500" />
                Current Understanding
                <span className="ml-auto text-xs text-muted-foreground group-open:hidden">
                  Click to expand
                </span>
              </summary>
              <div className="px-4 pb-3 text-xs space-y-2 max-h-40 overflow-y-auto">
                <p><strong>Summary:</strong> {currentPreview.summary}</p>
                {currentPreview.requirements.length > 0 && (
                  <div>
                    <strong>Requirements:</strong>
                    <ul className="list-disc list-inside mt-1">
                      {currentPreview.requirements.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                      {currentPreview.requirements.length > 3 && (
                        <li className="text-muted-foreground">
                          +{currentPreview.requirements.length - 3} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Or type your own answer..."
              disabled={loading || initializing}
              className={cn(
                "flex-1 px-3 py-2 rounded-lg border bg-background text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={loading || initializing || !input.trim()}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
```

**Step 2: Verify no syntax errors**

Run: `npx tsc --noEmit components/brainstorm-panel.tsx 2>&1 | head -20`
Expected: No output (no errors)

**Step 3: Commit**

```bash
git add components/brainstorm-panel.tsx
git commit -m "feat: add brainstorm panel component with chat UI"
```

---

## Task 9: Integrate Panel into Task Modal

**Files:**
- Modify: `components/task-modal.tsx`

**Step 1: Add state for panel**

Find this line near the top of the TaskModal component:
```typescript
const [loading, setLoading] = useState(false);
```

Add after it:
```typescript
const [showBrainstormPanel, setShowBrainstormPanel] = useState(false);
```

**Step 2: Add import for BrainstormPanel**

Add to imports at top of file:
```typescript
import { BrainstormPanel } from "@/components/brainstorm-panel";
```

**Step 3: Update handleBrainstorm to open panel**

Replace the `handleBrainstorm` function:
```typescript
const handleBrainstorm = async () => {
  // For interactive brainstorming, open the panel instead of calling API directly
  setShowBrainstormPanel(true);
};
```

**Step 4: Add handler for panel finalize**

Add after `handleBrainstorm`:
```typescript
const handleBrainstormFinalize = async () => {
  // Refresh task data after brainstorm finishes
  try {
    const res = await fetch(`/api/tasks/${task.id}`);
    if (res.ok) {
      const updatedTask = await res.json();
      onUpdate(updatedTask);
    }
  } catch (error) {
    console.error("Error refreshing task:", error);
  }
};
```

**Step 5: Add panel to render**

Find the closing `</div>` before the final `);` and add before it:
```typescript
{/* Brainstorm Panel */}
{showBrainstormPanel && (
  <BrainstormPanel
    taskId={task.id}
    taskTitle={task.title}
    isOpen={showBrainstormPanel}
    onClose={() => setShowBrainstormPanel(false)}
    onFinalize={handleBrainstormFinalize}
  />
)}
```

**Step 6: Verify no syntax errors**

Run: `npx tsc --noEmit components/task-modal.tsx 2>&1 | head -20`
Expected: No output (no errors)

**Step 7: Commit**

```bash
git add components/task-modal.tsx
git commit -m "feat: integrate brainstorm panel into task modal"
```

---

## Task 10: Add Tests for Brainstorm Chat

**Files:**
- Create: `__tests__/brainstorm-chat.test.ts`

**Step 1: Create the test file**

```typescript
// __tests__/brainstorm-chat.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getConversation,
  setConversation,
  deleteConversation,
  type BrainstormConversation,
} from "@/lib/ai/brainstorm-chat";

describe("brainstorm-chat", () => {
  beforeEach(() => {
    // Clear any existing conversations
    deleteConversation("test-task-1");
    deleteConversation("test-task-2");
  });

  describe("conversation store", () => {
    it("should store and retrieve conversation", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-1",
        messages: [{ role: "user", content: "Hello" }],
        repoContext: {
          techStack: ["Next.js"],
          fileStructure: ["app/"],
          configFiles: ["package.json"],
        },
      };

      setConversation("test-task-1", conversation);
      const retrieved = getConversation("test-task-1");

      expect(retrieved).toEqual(conversation);
    });

    it("should return undefined for non-existent conversation", () => {
      const result = getConversation("non-existent");
      expect(result).toBeUndefined();
    });

    it("should delete conversation", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-2",
        messages: [],
        repoContext: {
          techStack: [],
          fileStructure: [],
          configFiles: [],
        },
      };

      setConversation("test-task-2", conversation);
      expect(getConversation("test-task-2")).toBeDefined();

      deleteConversation("test-task-2");
      expect(getConversation("test-task-2")).toBeUndefined();
    });

    it("should update existing conversation", () => {
      const conversation: BrainstormConversation = {
        taskId: "test-task-1",
        messages: [{ role: "user", content: "Hello" }],
        repoContext: {
          techStack: ["Next.js"],
          fileStructure: [],
          configFiles: [],
        },
      };

      setConversation("test-task-1", conversation);

      // Update with new message
      const updated: BrainstormConversation = {
        ...conversation,
        messages: [
          ...conversation.messages,
          { role: "assistant", content: "Hi there!" },
        ],
      };

      setConversation("test-task-1", updated);
      const retrieved = getConversation("test-task-1");

      expect(retrieved?.messages).toHaveLength(2);
      expect(retrieved?.messages[1].content).toBe("Hi there!");
    });
  });
});
```

**Step 2: Run tests**

Run: `npm run test:run -- __tests__/brainstorm-chat.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add __tests__/brainstorm-chat.test.ts
git commit -m "test: add tests for brainstorm chat conversation store"
```

---

## Task 11: Final Integration Test

**Files:**
- None (manual testing)

**Step 1: Start development server**

Run: `npm run dev`
Expected: Server starts on http://localhost:3000

**Step 2: Test the flow**

1. Navigate to a repository with tasks
2. Create a new task or select an existing "todo" task
3. Click "Start Brainstorming" in the modal
4. Verify slide-over panel opens
5. Verify AI asks initial question with options
6. Click an option or type custom answer
7. Continue conversation until AI suggests completion
8. Click "Yes, Generate Plan"
9. Verify panel closes and task shows brainstorm result

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete interactive brainstorming feature"
```

---

## Verification Checklist

- [ ] Panel opens when clicking "Start Brainstorming"
- [ ] AI displays initial message with multiple-choice options
- [ ] Clicking options sends response to AI
- [ ] Typing custom message works
- [ ] Conversation flows naturally
- [ ] Current preview shows and updates
- [ ] AI suggests completion when ready
- [ ] Finalize saves result and closes panel
- [ ] Task modal shows formatted brainstorm result
- [ ] Panel closes on X button (discards conversation)
- [ ] Works on mobile (full-width panel)
