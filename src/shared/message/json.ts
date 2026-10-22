import type { Draft, JsonObject, JsonValue, Result } from '../contracts'
import { fail, ok } from '../result'
import { validateFcm } from './fcm'
import { validateApns } from './apns'
export const isObject = (v: unknown): v is JsonObject => !!v && typeof v === 'object' && !Array.isArray(v)
export const bytes = (v: unknown): number =>
  new TextEncoder().encode(typeof v === 'string' ? v : JSON.stringify(v)).length
function safe(value: JsonValue, depth = 0): boolean {
  if (depth > 64) return false
  if (Array.isArray(value)) return value.every((v) => safe(v, depth + 1))
  if (isObject(value))
    return Object.entries(value).every(
      ([key, v]) => !['__proto__', 'constructor', 'prototype'].includes(key) && safe(v, depth + 1),
    )
  return typeof value !== 'number' || Number.isFinite(value)
}
export function parsePayload(raw: string): Result<JsonObject> {
  try {
    if (bytes(raw) > 1024 * 1024) return fail('PAYLOAD_TOO_LARGE', '编辑内容不能超过 1 MiB', 'rawText')
    const value: JsonValue = JSON.parse(raw)
    if (!isObject(value) || !safe(value))
      return fail(
        'INVALID_JSON_OBJECT',
        '消息必须是安全的 JSON 对象，不能包含保留原型键或过深结构',
        'rawText',
      )
    return ok(value)
  } catch (error) {
    const pos = /position (\d+)/.exec(String(error))
    const line = pos ? raw.slice(0, Number(pos[1])).split('\n').length : undefined
    return fail(
      'INVALID_JSON',
      `JSON 格式错误${line ? `，请检查第 ${line} 行` : '，请检查括号、逗号和引号'}`,
      'rawText',
    )
  }
}
export function validatePayload(draft: Draft): Result<JsonObject> {
  if (
    draft.mode === 'form' &&
    draft.messageType !== 'notification' &&
    typeof draft.formStash.dataEditorText === 'string'
  ) {
    const data = parsePayload(draft.formStash.dataEditorText)
    if (!data.ok) return fail('INVALID_DATA_JSON', '自定义数据 JSON 格式错误，请修复后发送', 'data')
    if (draft.platform === 'ios' && 'aps' in data.value)
      return fail('RESERVED_APS', '自定义数据不能覆盖 aps', 'data')
    if (draft.platform === 'android' && Object.values(data.value).some((v) => typeof v !== 'string'))
      return fail('INVALID_DATA', 'FCM 自定义数据的值必须是字符串', 'data')
  }
  const parsed = parsePayload(draft.rawText)
  if (!parsed.ok) return parsed
  return draft.platform === 'android' ? validateFcm(parsed.value) : validateApns(parsed.value, draft.advanced)
}
