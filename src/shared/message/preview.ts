import type { PublicConfig, SendInput, Result, PreviewRequest, JsonObject } from '../contracts'
import { ok, fail } from '../result'
import { validatePayload, bytes } from './json'
import { apnsType } from './apns'
export function buildPreview(config: PublicConfig, input: SendInput): Result<PreviewRequest> {
  if (input.scope.platform !== input.draft.platform) return fail('PLATFORM_MISMATCH', '消息平台与设备不一致')
  if (!input.token.trim()) return fail('MISSING_TOKEN', '请填写设备 token', 'token')
  const p = validatePayload(input.draft)
  if (!p.ok) return p
  let url: string,
    body: JsonObject,
    headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (input.scope.platform === 'android') {
    url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(input.scope.projectId)}/messages:send`
    body = { message: { ...p.value, token: input.token.trim() } }
    headers.Authorization = 'Bearer <已隐藏>'
  } else {
    if (!/^[a-fA-F0-9]+$/.test(input.token.trim()))
      return fail('INVALID_TOKEN', 'APNs token 应为十六进制字符串', 'token')
    const type = apnsType(p.value)!,
      advanced = input.draft.advanced
    url = `https://${input.scope.environment === 'test' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'}/3/device/${input.token.trim()}`
    body = p.value
    headers['apns-topic'] = input.scope.bundleId
    headers['apns-push-type'] = type
    headers['apns-priority'] = String(advanced.priority ?? (type === 'background' ? 5 : 10))
    if (advanced.expiration !== undefined) headers['apns-expiration'] = String(advanced.expiration)
    if (advanced.collapseId) headers['apns-collapse-id'] = String(advanced.collapseId)
    if (config.ios[input.scope.environment].authKind === 'p8') headers.authorization = 'bearer <已隐藏>'
  }
  return ok({ method: 'POST', url, headers, body, estimatedBytes: bytes(p.value) })
}
