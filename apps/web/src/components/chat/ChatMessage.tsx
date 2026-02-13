import type { ChatMessage as ChatMessageType } from '@loopforge/shared'
import { ChatRole } from '@loopforge/shared'
import { cn } from '../../lib/utils'

interface ChatMessageProps {
  message: ChatMessageType
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === ChatRole.USER

  return (
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'border bg-card text-card-foreground',
        )}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        {!isUser && message.provider && (
          <p className="mt-1 text-xs opacity-60">
            {message.provider} / {message.model}
            {message.tokenCount != null && ` · ${message.tokenCount} tokens`}
          </p>
        )}
      </div>
    </div>
  )
}

interface StreamingMessageProps {
  content: string
}

export function StreamingMessage({ content }: StreamingMessageProps) {
  return (
    <div className="flex gap-3">
      <div className="max-w-[80%] rounded-xl border bg-card px-4 py-2.5 text-sm text-card-foreground">
        <p className="whitespace-pre-wrap leading-relaxed">
          {content}
          <span className="ml-0.5 animate-pulse">▌</span>
        </p>
      </div>
    </div>
  )
}
