/**
 * SSE (Server-Sent Events) client utility.
 *
 * Uses the Fetch API with a ReadableStream to support authorization headers,
 * since the native EventSource API does not support custom headers.
 */

export interface SSECallbacks<T> {
  onMessage: (data: T) => void
  onDone?: () => void
  onError?: (error: Error) => void
}

/**
 * Subscribes to an SSE stream endpoint.
 * Returns a cleanup function that aborts the stream when called.
 *
 * Each SSE message must be in the format: `data: <json>\n\n`
 */
export function subscribeToStream<T>(
  url: string,
  callbacks: SSECallbacks<T>,
): () => void {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status} ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('SSE response has no body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          callbacks.onDone?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })

        // Split on SSE double-newline boundaries
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? '' // keep incomplete chunk in buffer

        for (const block of lines) {
          const dataLine = block
            .split('\n')
            .find((l) => l.startsWith('data: '))

          if (!dataLine) continue

          const jsonStr = dataLine.slice(6).trim()
          if (jsonStr === '[DONE]') {
            callbacks.onDone?.()
            return
          }

          try {
            const parsed = JSON.parse(jsonStr) as T
            callbacks.onMessage(parsed)

            // Check if this is a "done" event by convention
            const asRecord = parsed as Record<string, unknown>
            if (asRecord.type === 'done') {
              callbacks.onDone?.()
              return
            }
          } catch {
            // Ignore malformed JSON lines
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return // Normal cleanup
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  return () => controller.abort()
}

/**
 * Subscribes to SSE with POST body (for chat streaming).
 */
export function postSubscribeToStream<TRequest, TResponse>(
  url: string,
  body: TRequest,
  callbacks: SSECallbacks<TResponse>,
): () => void {
  const controller = new AbortController()

  ;(async () => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SSE request failed: ${response.status} — ${errorText}`)
      }

      if (!response.body) {
        throw new Error('SSE response has no body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          callbacks.onDone?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n\n')
        buffer = lines.pop() ?? ''

        for (const block of lines) {
          const dataLine = block.split('\n').find((l) => l.startsWith('data: '))
          if (!dataLine) continue

          const jsonStr = dataLine.slice(6).trim()
          try {
            const parsed = JSON.parse(jsonStr) as TResponse
            callbacks.onMessage(parsed)

            const asRecord = parsed as Record<string, unknown>
            if (asRecord.type === 'done' || asRecord.type === 'error') {
              callbacks.onDone?.()
              return
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      callbacks.onError?.(err instanceof Error ? err : new Error(String(err)))
    }
  })()

  return () => controller.abort()
}
