import OpenAI from 'openai'
import type { AIProvider, AIMessage, ProviderOptions } from './provider.interface.js'

export class OpenAIProvider implements AIProvider {
  private client: OpenAI

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey })
  }

  async *stream(messages: AIMessage[], options: ProviderOptions): AsyncIterable<string> {
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

    if (options.systemPrompt) {
      openaiMessages.push({ role: 'system', content: options.systemPrompt })
    }

    for (const msg of messages) {
      openaiMessages.push({ role: msg.role, content: msg.content })
    }

    let attempt = 0
    while (true) {
      try {
        const stream = await this.client.chat.completions.create({
          model: options.model,
          max_tokens: options.maxTokens ?? 4096,
          messages: openaiMessages,
          stream: true,
        })

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content
          if (delta) yield delta
        }
        return
      } catch (err: unknown) {
        const e = err as { status?: number; headers?: { get?: (k: string) => string | null } }
        if (e?.status === 429 && attempt < 2) {
          const retryAfter = parseInt(e?.headers?.get?.('retry-after') ?? '60', 10)
          yield `[OpenAI rate limit hit. Retrying in ${retryAfter}s…]`
          await new Promise((r) => setTimeout(r, retryAfter * 1000))
          attempt++
        } else {
          throw err
        }
      }
    }
  }
}
