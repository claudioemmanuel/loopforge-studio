import Anthropic from "@anthropic-ai/sdk";
import type { AIClient, ChatMessage, ChatOptions } from "../client";
import type { AiProvider } from "@/lib/db/schema";
import { parseAnthropicError } from "@/lib/errors";

export class AnthropicClient implements AIClient {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string = "claude-sonnet-4-20250514") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      // Extract system message if present
      let systemPrompt: string | undefined;
      const conversationMessages: Array<{
        role: "user" | "assistant";
        content: string;
      }> = [];

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

      // Extract token usage from response
      if (options?.onTokenUsage && response.usage) {
        const tokenUsage = {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        };
        await Promise.resolve(options.onTokenUsage(tokenUsage));
      }

      // Extract text from response
      const text = response.content
        .filter((block) => block.type === "text")
        .map((block) => (block as { type: "text"; text: string }).text)
        .join("");

      return text;
    } catch (error) {
      // Parse and re-throw as APIError
      throw parseAnthropicError(error);
    }
  }

  getProvider(): AiProvider {
    return "anthropic";
  }

  getModel(): string {
    return this.model;
  }
}
