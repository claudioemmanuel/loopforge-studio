import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider, AIMessage, ProviderOptions } from './provider.interface.js'

export class AnthropicProvider implements AIProvider {
  private client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async *stream(messages: AIMessage[], options: ProviderOptions): AsyncIterable<string> {
    const anthropicMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    let attempt = 0
    while (true) {
      try {
        const stream = this.client.messages.stream({
          model: options.model,
          max_tokens: options.maxTokens ?? 4096,
          system: options.systemPrompt,
          messages: anthropicMessages,
        })

        for await (const event of stream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            yield event.delta.text
          }
        }
        return
      } catch (err: unknown) {
        const e = err as { status?: number; headers?: { get?: (k: string) => string | null } }
        if (e?.status === 429 && attempt < 2) {
          const retryAfterMs = parseInt(e?.headers?.get?.('retry-after-ms') ?? '60000', 10)
          const retryAfterSec = Math.ceil(retryAfterMs / 1000)
          yield `[Anthropic rate limit hit. Retrying in ${retryAfterSec}s…]`
          await new Promise((r) => setTimeout(r, retryAfterMs))
          attempt++
        } else {
          throw err
        }
      }
    }
  }
}
