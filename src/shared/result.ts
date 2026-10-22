import type { Result } from './contracts'
export const ok = <T>(value: T): Result<T> => ({ ok: true, value })
export const fail = (code: string, message: string, field?: string, retryable = false): Result<never> => ({
  ok: false,
  error: { code, message, field, retryable },
})
