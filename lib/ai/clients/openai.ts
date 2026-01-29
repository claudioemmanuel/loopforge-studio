import OpenAI from "openai";
import type { AIClient, ChatMessage, ChatOptions } from "../client";
import type { AiProvider } from "@/lib/db/schema";
import { parseOpenAIError } from "@/lib/errors";

export class OpenAIClient implements AIClient {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = "gpt-4o") {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    try {
      // Convert messages to OpenAI format
      const openaiMessages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
      }> = messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 1,
        messages: openaiMessages,
      });

      // Extract token usage from response
      if (options?.onTokenUsage && response.usage) {
        const tokenUsage = {
          inputTokens: response.usage.prompt_tokens,
          outputTokens: response.usage.completion_tokens,
          totalTokens: response.usage.total_tokens,
        };
        await Promise.resolve(options.onTokenUsage(tokenUsage));
      }

      // Extract text from response
      const text = response.choices[0]?.message?.content ?? "";
      return text;
    } catch (error) {
      // Parse and re-throw as APIError
      throw parseOpenAIError(error);
    }
  }

  getProvider(): AiProvider {
    return "openai";
  }

  getModel(): string {
    return this.model;
  }
}
