import type { ApiErrorResponse } from '@loopforge/shared'
import { toast } from 'sonner'

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api'

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorResponse,
  ) {
    super(body.message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  init?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    ...init,
  })

  if (!response.ok) {
    let errorBody: ApiErrorResponse
    try {
      errorBody = await response.json()
    } catch {
      errorBody = {
        statusCode: response.status,
        error: 'Unknown Error',
        message: response.statusText,
      }
    }
    // Surface 4xx/5xx errors as dismissible toasts (skip 401 — handled by AuthGuard redirect)
    if (response.status !== 401) {
      toast.error(errorBody.message || 'Request failed', {
        description: `${response.status} ${errorBody.error ?? ''}`.trim(),
      })
    }
    throw new ApiError(response.status, errorBody)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const apiClient = {
  get<T>(path: string, init?: RequestInit): Promise<T> {
    return request<T>('GET', path, undefined, init)
  },

  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>('POST', path, body, init)
  },

  patch<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>('PATCH', path, body, init)
  },

  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T> {
    return request<T>('PUT', path, body, init)
  },

  delete<T = void>(path: string, init?: RequestInit): Promise<T> {
    return request<T>('DELETE', path, undefined, init)
  },
}
