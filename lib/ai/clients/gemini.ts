import { GoogleGenerativeAI } from "@google/generative-ai";
import type { AIClient, ChatMessage, ChatOptions } from "../client";
import type { AiProvider } from "@/lib/db/schema";

export class GeminiClient implements AIClient {
  private client: GoogleGenerativeAI;
  private model: string;

  constructor(apiKey: string, model: string = "gemini-2.5-pro") {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const generativeModel = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature ?? 1,
      },
    });

    // Extract system instruction if present
    let systemInstruction: string | undefined;
    const conversationHistory: Array<{
      role: "user" | "model";
      parts: Array<{ text: string }>;
    }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        systemInstruction = msg.content;
      } else {
        conversationHistory.push({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    // Start chat with history (exclude last message which we'll send)
    const lastMessage = conversationHistory.pop();
    if (!lastMessage) {
      throw new Error("No messages to send");
    }

    const chat = generativeModel.startChat({
      history: conversationHistory,
      ...(systemInstruction && {
        systemInstruction: {
          role: "user",
          parts: [{ text: systemInstruction }],
        },
      }),
    });

    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = result.response;
    const text = response.text();

    return text;
  }

  getProvider(): AiProvider {
    return "gemini";
  }

  getModel(): string {
    return this.model;
  }
}
