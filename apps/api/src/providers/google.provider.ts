import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider, AIMessage, ProviderOptions } from './provider.interface.js'

export class GoogleProvider implements AIProvider {
  private client: GoogleGenerativeAI

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey)
  }

  async *stream(messages: AIMessage[], options: ProviderOptions): AsyncIterable<string> {
    const model = this.client.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt,
    })

    // Convert messages to Google's format
    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) return

    let attempt = 0
    while (true) {
      try {
        const chat = model.startChat({ history })
        const result = await chat.sendMessageStream(lastMessage.content)

        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) yield text
        }
        return
      } catch (err: unknown) {
        const e = err as { status?: number; httpStatusCode?: number; headers?: Record<string, string> }
        const status = e?.status ?? e?.httpStatusCode
        if (status === 429 && attempt < 2) {
          const retryAfter = parseInt(e?.headers?.['retry-after'] ?? '60', 10)
          yield `[Gemini rate limit hit. Retrying in ${retryAfter}s…]`
          await new Promise((r) => setTimeout(r, retryAfter * 1000))
          attempt++
        } else {
          throw err
        }
      }
    }
  }
}
