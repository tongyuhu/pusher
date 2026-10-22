import type { Draft, JsonObject, Result } from '../contracts'
import { ok, fail } from '../result'
import { parsePayload, isObject, bytes } from './json'
export interface FormPatch {
  title?: string
  body?: string
  data?: JsonObject
  androidPriority?: string
  ttl?: number | null
  channelId?: string
  sound?: string
  badge?: number | null
  priority?: number | null
  expiration?: number | null
  collapseId?: string
}
function updated(d: Draft, p: JsonObject, advanced = d.advanced): Draft {
  return {
    ...d,
    revision: d.revision + 1,
    lastValidPayload: p,
    rawText: JSON.stringify(p, null, 2),
    advanced,
  }
}
export function patchForm(draft: Draft, patch: FormPatch): Result<Draft> {
  const parsed = parsePayload(draft.rawText)
  if (!parsed.ok) return parsed
  const p = parsed.value,
    advanced = { ...draft.advanced }
  if (
    patch.ttl !== undefined &&
    patch.ttl !== null &&
    (!Number.isFinite(patch.ttl) || patch.ttl < 0 || patch.ttl > 2419200)
  )
    return fail('INVALID_TTL', 'TTL 必须在 0 到 2419200 秒内', 'ttl')
  if (patch.collapseId !== undefined && bytes(patch.collapseId) > 64)
    return fail('INVALID_COLLAPSE', '折叠 ID 太长', 'collapseId')
  if (draft.platform === 'android') {
    if (patch.title !== undefined || patch.body !== undefined) {
      if (p.notification !== undefined && !isObject(p.notification))
        return fail('JSON_MANAGED', '通知结构由 JSON 管理')
      const n = isObject(p.notification) ? p.notification : {}
      if (patch.title !== undefined) n.title = patch.title
      if (patch.body !== undefined) n.body = patch.body
      p.notification = n
    }
    if (patch.data !== undefined) p.data = patch.data
    if (patch.androidPriority !== undefined || patch.ttl !== undefined || patch.channelId !== undefined) {
      const a = isObject(p.android) ? p.android : {}
      if (patch.androidPriority !== undefined) {
        if (patch.androidPriority) a.priority = patch.androidPriority
        else delete a.priority
      }
      if (patch.ttl !== undefined) {
        if (patch.ttl === null) delete a.ttl
        else a.ttl = `${patch.ttl}s`
      }
      if (patch.channelId !== undefined) {
        const n = isObject(a.notification) ? a.notification : {}
        if (patch.channelId) n.channel_id = patch.channelId
        else delete n.channel_id
        if (Object.keys(n).length) a.notification = n
        else delete a.notification
      }
      if (Object.keys(a).length) p.android = a
      else delete p.android
    }
  } else {
    const aps = isObject(p.aps) ? p.aps : {}
    if (patch.title !== undefined || patch.body !== undefined) {
      if (aps.alert !== undefined && !isObject(aps.alert))
        return fail('JSON_MANAGED', '此 alert 由 JSON 管理，请在 JSON 中编辑')
      const alert = isObject(aps.alert) ? aps.alert : {}
      if (patch.title !== undefined) alert.title = patch.title
      if (patch.body !== undefined) alert.body = patch.body
      aps.alert = alert
    }
    if (patch.data !== undefined) {
      if ('aps' in patch.data) return fail('RESERVED_APS', '自定义数据不能覆盖 aps', 'data')
      for (const key of Object.keys(p)) if (key !== 'aps') delete p[key]
      Object.assign(p, patch.data)
    }
    if (patch.sound !== undefined) {
      if (patch.sound) aps.sound = patch.sound
      else delete aps.sound
    }
    if (patch.badge !== undefined) {
      if (patch.badge === null) delete aps.badge
      else aps.badge = patch.badge
    }
    for (const key of ['priority', 'expiration', 'collapseId'] as const)
      if (patch[key] !== undefined) {
        if (patch[key] === null || patch[key] === '') delete advanced[key]
        else advanced[key] = patch[key]!
      }
    p.aps = aps
  }
  // 所有表单输入仍经过相同的安全 JSON 检查。
  const safe = parsePayload(JSON.stringify(p))
  if (!safe.ok) return safe
  return ok(updated(draft, p, advanced))
}
export function switchEditor(draft: Draft, mode: 'form' | 'json'): Result<Draft> {
  const p = parsePayload(draft.rawText)
  if (!p.ok) return p
  if (draft.mode === mode) return ok(draft)
  let stash = { ...draft.formStash }
  let messageType = draft.messageType
  if (mode === 'json') stash.jsonBaseline = JSON.stringify(p.value)
  else {
    // JSON 改动后，旧的隐藏字段不应重新复活已删除或改写的内容。
    if (stash.jsonBaseline !== JSON.stringify(p.value)) stash = {}
    delete stash.jsonBaseline
    delete stash.dataEditorText
    const aps = isObject(p.value.aps) ? p.value.aps : {}
    const notification =
      draft.platform === 'android'
        ? p.value.notification !== undefined
        : ['alert', 'sound', 'badge'].some((key) => aps[key] !== undefined)
    const data =
      draft.platform === 'android'
        ? p.value.data !== undefined
        : Object.keys(p.value).some((key) => key !== 'aps')
    messageType = notification ? (data ? 'mixed' : 'notification') : 'data'
  }
  return ok({ ...updated(draft, p.value), mode, messageType, formStash: stash })
}
export function switchMessageType(draft: Draft, type: Draft['messageType']): Result<Draft> {
  const parsed = parsePayload(draft.rawText)
  if (!parsed.ok) return parsed
  const p = parsed.value,
    stash = { ...draft.formStash },
    advanced = { ...draft.advanced }
  if (draft.platform === 'android') {
    if (type === 'data') {
      if (p.notification) stash.notification = p.notification
      delete p.notification
      if (isObject(p.android) && p.android.notification) {
        stash.androidNotification = p.android.notification
        delete p.android.notification
        if (!Object.keys(p.android).length) delete p.android
      }
    } else {
      if (!p.notification)
        p.notification = stash.notification || { title: '推送测试', body: '这是一条测试消息' }
      if (isObject(stash.androidNotification)) {
        const android = isObject(p.android) ? p.android : {}
        android.notification = {
          ...stash.androidNotification,
          ...(isObject(android.notification) ? android.notification : {}),
        }
        p.android = android
      }
    }
    if (type === 'notification') {
      if (p.data) stash.data = p.data
      delete p.data
    } else if (!p.data) p.data = stash.data || {}
  } else {
    const aps = isObject(p.aps) ? p.aps : {}
    if (type === 'data') {
      for (const key of ['alert', 'sound', 'badge']) {
        if (aps[key] !== undefined) stash[key] = aps[key]
        delete aps[key]
      }
      aps['content-available'] = 1
      advanced.priority = 5
    } else {
      delete aps['content-available']
      aps.alert = aps.alert || stash.alert || { title: '推送测试', body: '这是一条测试消息' }
      for (const key of ['sound', 'badge'])
        if (aps[key] === undefined && stash[key] !== undefined) aps[key] = stash[key]
      delete advanced.priority
    }
    if (type === 'notification') {
      const data: JsonObject = {}
      for (const key of Object.keys(p))
        if (key !== 'aps') {
          data[key] = p[key]
          delete p[key]
        }
      stash.data = data
    } else if (isObject(stash.data))
      for (const [key, value] of Object.entries(stash.data)) if (!Object.hasOwn(p, key)) p[key] = value
    p.aps = aps
  }
  return ok({ ...updated(draft, p, advanced), messageType: type, formStash: stash })
}
