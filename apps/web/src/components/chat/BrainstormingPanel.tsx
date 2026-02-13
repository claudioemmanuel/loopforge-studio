import { useEffect, useRef, useState } from 'react'
import type { Task, ChatMessage as ChatMessageType } from '@loopforge/shared'
import { Provider } from '@loopforge/shared'
import { apiClient } from '../../services/api.client'
import { postSubscribeToStream } from '../../services/sse.client'
import { useBoardStore } from '../../store/board.store'
import { Stage } from '@loopforge/shared'
import type { ChatSSEEvent, SendChatMessageRequest } from '@loopforge/shared'
import { ChatMessage, StreamingMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { ProviderSelector } from './ProviderSelector'
import { Loader2 } from 'lucide-react'

interface BrainstormingPanelProps {
  task: Task
}

export function BrainstormingPanel({ task }: BrainstormingPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isFinalizingPlan, setIsFinalizingPlan] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [selectedModel, setSelectedModel] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { transitionTaskStage } = useBoardStore()
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    apiClient
      .get<ChatMessageType[]>(`/tasks/${task.id}/chat`)
      .then(setMessages)
      .catch(console.error)

    return () => cleanupRef.current?.()
  }, [task.id])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = (content: string) => {
    if (!selectedProvider || !selectedModel) return

    const userMessage: ChatMessageType = {
      id: crypto.randomUUID(),
      taskId: task.id,
      role: 'USER' as ChatMessageType['role'],
      content,
      provider: null,
      model: null,
      tokenCount: null,
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMessage])
    setIsStreaming(true)
    setStreamingContent('')

    const body: SendChatMessageRequest = {
      content,
      provider: selectedProvider,
      model: selectedModel,
    }

    let accumulated = ''

    cleanupRef.current = postSubscribeToStream<SendChatMessageRequest, ChatSSEEvent>(
      `/api/tasks/${task.id}/chat/stream`,
      body,
      {
        onMessage: (event) => {
          if (event.type === 'chunk') {
            accumulated += event.content
            setStreamingContent(accumulated)
          } else if (event.type === 'done') {
            const assistantMsg: ChatMessageType = {
              id: crypto.randomUUID(),
              taskId: task.id,
              role: 'ASSISTANT' as ChatMessageType['role'],
              content: accumulated,
              provider: selectedProvider,
              model: selectedModel,
              tokenCount: (event as { type: 'done'; tokenCount: number }).tokenCount ?? null,
              createdAt: new Date().toISOString(),
            }
            setMessages((prev) => [...prev, assistantMsg])
            setStreamingContent('')
            setIsStreaming(false)
          } else if (event.type === 'error') {
            console.error('Chat error:', event.message)
            setIsStreaming(false)
            setStreamingContent('')
          }
        },
        onDone: () => setIsStreaming(false),
        onError: (err) => {
          console.error(err)
          setIsStreaming(false)
          setStreamingContent('')
        },
      },
    )
  }

  const handleFinalize = async () => {
    setIsFinalizingPlan(true)
    try {
      await transitionTaskStage(task.id, Stage.PLANNING)
    } finally {
      setIsFinalizingPlan(false)
    }
  }

  const coldStartMessage = messages.length === 0
    ? `Okay, let's break down how to approach: **${task.title}**. Tell me what you'd like to achieve — any constraints, existing patterns, or context I should know about?`
    : null

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <ProviderSelector
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          onSelect={(p, m) => {
            setSelectedProvider(p)
            setSelectedModel(m)
          }}
        />
        <button
          onClick={handleFinalize}
          disabled={isFinalizingPlan}
          className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {isFinalizingPlan && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isFinalizingPlan ? 'Generating plan…' : 'Finalize → Planning'}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto touch-pan-y p-4">
        {coldStartMessage && (
          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground italic">
            {coldStartMessage.split('**').map((part, i) =>
              i % 2 === 1 ? <strong key={i} className="text-foreground not-italic">{part}</strong> : part
            )}
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {streamingContent && <StreamingMessage content={streamingContent} />}
      </div>

      <div className="sticky bottom-0">
        <ChatInput onSend={handleSend} isStreaming={isStreaming} />
      </div>
    </div>
  )
}
