import Anthropic from "@anthropic-ai/sdk";
import type { AIClient, ChatMessage, ChatOptions } from "../client";
import type { AiProvider } from "@/lib/db/schema";

export class AnthropicClient implements AIClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    // Extract system message if present
    let systemPrompt: string | undefined;
    const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemPrompt = msg.content;
      } else {
        conversationMessages.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(systemPrompt && { system: systemPrompt }),
      messages: conversationMessages,
    });

    // Extract text from response
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block as { type: "text"; text: string }).text)
      .join("");

    return text;
  }

  getProvider(): AiProvider {
    return "anthropic";
  }

  getModel(): string {
    return this.model;
  }
}
