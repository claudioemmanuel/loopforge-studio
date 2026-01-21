import type { AiProvider } from "@/lib/db/schema";

// Message format for AI chat
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Options for chat completion
export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

// Unified AI client interface
export interface AIClient {
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
  getProvider(): AiProvider;
  getModel(): string;
}

// Factory function to create AI client based on provider
export async function createAIClient(
  provider: AiProvider,
  apiKey: string,
  model: string
): Promise<AIClient> {
  switch (provider) {
    case "anthropic": {
      // Dynamically import to avoid loading all SDKs
      const { AnthropicClient } = await import("./clients/anthropic");
      return new AnthropicClient(apiKey, model);
    }
    case "openai": {
      const { OpenAIClient } = await import("./clients/openai");
      return new OpenAIClient(apiKey, model);
    }
    case "gemini": {
      const { GeminiClient } = await import("./clients/gemini");
      return new GeminiClient(apiKey, model);
    }
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

// Helper to get default model for a provider
export function getDefaultModel(provider: AiProvider): string {
  switch (provider) {
    case "anthropic":
      return "claude-sonnet-4-20250514";
    case "openai":
      return "gpt-4o";
    case "gemini":
      return "gemini-2.5-pro";
    default:
      return "claude-sonnet-4-20250514";
  }
}
