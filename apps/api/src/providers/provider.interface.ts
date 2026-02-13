import { Provider } from '@loopforge/shared'
import { prisma } from '../prisma/client.js'
import { decrypt } from '../services/encryption.service.js'

export interface AIMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ProviderOptions {
  model: string
  maxTokens?: number
  systemPrompt?: string
}

export interface AIProvider {
  stream(messages: AIMessage[], options: ProviderOptions): AsyncIterable<string>
  countTokens?(messages: AIMessage[]): Promise<number>
}

/**
 * Factory: creates the appropriate provider instance for a user's configured provider.
 */
export async function createProvider(userId: string, provider: Provider): Promise<{ provider: AIProvider; defaultModel: string }> {
  const config = await prisma.providerConfig.findFirst({
    where: { userId, provider },
  })

  if (!config || !config.encryptedApiKey) {
    throw Object.assign(
      new Error(`No API key configured for provider: ${provider}`),
      { statusCode: 422 },
    )
  }

  const apiKey = decrypt(config.encryptedApiKey)

  switch (provider) {
    case Provider.ANTHROPIC: {
      const { AnthropicProvider } = await import('./anthropic.provider.js')
      return { provider: new AnthropicProvider(apiKey), defaultModel: config.defaultModel }
    }
    case Provider.OPENAI: {
      const { OpenAIProvider } = await import('./openai.provider.js')
      return { provider: new OpenAIProvider(apiKey), defaultModel: config.defaultModel }
    }
    case Provider.GOOGLE: {
      const { GoogleProvider } = await import('./google.provider.js')
      return { provider: new GoogleProvider(apiKey), defaultModel: config.defaultModel }
    }
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
