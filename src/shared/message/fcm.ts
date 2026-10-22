import type { JsonObject,Result } from '../contracts'
import { fail,ok } from '../result'
import { isObject } from './json'
export function validateFcm(payload: JsonObject): Result<JsonObject> {
  if (['message','token','topic','condition'].some(k=>k in payload)) return fail('ROUTING_FIELD','此处只编辑消息内容，请使用上方 token 选择器指定目标','rawText')
  if (payload.data !== undefined && (!isObject(payload.data) || Object.entries(payload.data).some(([k,v])=>typeof v!=='string'||['from','message_type'].includes(k)||/^(google\.|gcm\.)/.test(k)))) return fail('INVALID_DATA','FCM 自定义数据必须是字符串键值，不能使用保留键','data')
  if (payload.notification !== undefined && (!isObject(payload.notification) || !['title','body'].some(k=>typeof (payload.notification as JsonObject)[k]==='string' && String((payload.notification as JsonObject)[k]).trim()))) return fail('EMPTY_NOTIFICATION','通知消息至少填写标题或正文','title')
  if (!payload.notification && !payload.data && !payload.android) return fail('EMPTY_PAYLOAD','请填写通知或自定义数据')
  if (payload.android !== undefined) {
    if (!isObject(payload.android)) return fail('INVALID_ANDROID','android 必须是对象')
    const a=payload.android
    if (a.priority!==undefined && !['high','normal','HIGH','NORMAL'].includes(String(a.priority))) return fail('INVALID_PRIORITY','Android 优先级无效','androidPriority')
    if (a.ttl!==undefined && (!/^\d+(\.\d{1,9})?s$/.test(String(a.ttl)) || Number(String(a.ttl).slice(0,-1))>2419200)) return fail('INVALID_TTL','TTL 必须在 0 到 2419200 秒内','ttl')
  }
  return ok(payload)
}
