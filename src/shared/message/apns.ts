import type { JsonObject, Result } from '../contracts'
import { fail, ok } from '../result'
import { bytes, isObject } from './json'
export function apnsType(payload: JsonObject): 'alert' | 'background' | undefined {
  const aps = payload.aps
  if (!isObject(aps)) return
  if (aps.alert !== undefined || aps.sound !== undefined || aps.badge !== undefined) return 'alert'
  if (aps['content-available'] === 1) return 'background'
}
export function validateApns(payload: JsonObject, advanced: JsonObject): Result<JsonObject> {
  if (!isObject(payload.aps) || !apnsType(payload))
    return fail('INVALID_APS', 'APNs 消息需要 aps 通知内容或后台标记', 'rawText')
  if (bytes(payload) > 4096)
    return fail('PAYLOAD_TOO_LARGE', 'APNs 消息不能超过 4096 个 UTF-8 字节', 'rawText')
  const aps = payload.aps
  if (aps.badge !== undefined && (!Number.isInteger(aps.badge) || Number(aps.badge) < 0))
    return fail('INVALID_BADGE', '角标必须是非负整数', 'badge')
  if (advanced.priority !== undefined && ![5, 10].includes(Number(advanced.priority)))
    return fail('INVALID_PRIORITY', 'APNs 优先级只能是 5 或 10', 'priority')
  if (
    apnsType(payload) === 'background' &&
    advanced.priority !== undefined &&
    Number(advanced.priority) !== 5
  )
    return fail('BACKGROUND_PRIORITY', '后台通知的优先级必须为 5', 'priority')
  if (
    advanced.expiration !== undefined &&
    (!Number.isInteger(advanced.expiration) || Number(advanced.expiration) < 0)
  )
    return fail('INVALID_EXPIRATION', '过期时间必须是非负 UTC 秒', 'expiration')
  if (
    advanced.collapseId !== undefined &&
    (typeof advanced.collapseId !== 'string' ||
      bytes(advanced.collapseId) > 64 ||
      /[\r\n]/.test(advanced.collapseId))
  )
    return fail('INVALID_COLLAPSE', '折叠 ID 不能超过 64 个 UTF-8 字节或包含换行', 'collapseId')
  return ok(payload)
}
