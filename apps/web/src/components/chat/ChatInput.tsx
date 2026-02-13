import { useState, useRef } from 'react'
import { Send } from 'lucide-react'

interface ChatInputProps {
  onSend: (content: string) => void
  isStreaming: boolean
}

export function ChatInput({ onSend, isStreaming }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = () => {
    const trimmed = value.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setValue('')
    textareaRef.current?.focus()
  }

  return (
    <div className="flex gap-2 border-t p-3">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={isStreaming ? 'AI is thinking…' : 'Message the AI (Enter to send, Shift+Enter for newline)'}
        disabled={isStreaming}
        rows={3}
        className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
      />
      <button
        onClick={handleSend}
        disabled={!value.trim() || isStreaming}
        className="self-end rounded-lg bg-primary p-2 text-primary-foreground hover:opacity-90 disabled:opacity-50"
      >
        <Send className="h-4 w-4" />
      </button>
    </div>
  )
}
