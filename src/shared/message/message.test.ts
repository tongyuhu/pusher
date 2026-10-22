import { expect, it } from 'vitest'
import { createDraft } from './draft'
import { patchForm, switchEditor, switchMessageType } from './form'
import { parsePayload, validatePayload } from './json'
import { buildPreview } from './preview'
import type { Draft, PublicConfig } from '../contracts'
const config: PublicConfig = {
  revision: 1,
  displayName: '示例',
  android: { test: { packageName: 'com.example' }, production: { packageName: 'com.example' } },
  ios: {
    test: { bundleId: 'com.example', authKind: 'p8' },
    production: { bundleId: 'com.example', authKind: 'p12' },
  },
}
function value<T>(r: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!r.ok) throw Error(JSON.stringify(r.error))
  return r.value
}
function raw(platform: 'ios' | 'android', payload: unknown): Draft {
  return { ...createDraft(platform), mode: 'json', rawText: JSON.stringify(payload) }
}
it('FCM 三种消息互相切换并恢复通知内容', () => {
  let d = createDraft('android')
  d = value(patchForm(d, { title: '标题', body: '正文', data: { type: 'test' } }))
  d = value(switchMessageType(d, 'data'))
  expect(value(validatePayload(d))).toEqual({ data: { type: 'test' } })
  d = value(switchMessageType(d, 'mixed'))
  expect(value(validatePayload(d))).toEqual({
    notification: { title: '标题', body: '正文' },
    data: { type: 'test' },
  })
})
it('表单往返保留未知嵌套字段，JSON 始终为权威内容', () => {
  let d = raw('android', {
    notification: { title: 'old', image: 'https://example.test/a' },
    android: { notification: { color: '#fff' } },
  })
  d = value(switchEditor(d, 'form'))
  d = value(patchForm(d, { title: 'new' }))
  d = value(switchEditor(d, 'json'))
  expect(JSON.parse(d.rawText)).toEqual({
    notification: { title: 'new', image: 'https://example.test/a' },
    android: { notification: { color: '#fff' } },
  })
})
it('不可表单化的 APNs alert 保留原数据', () => {
  const d = raw('ios', { aps: { alert: '直接字符串' }, custom: { x: 1 } })
  expect(patchForm(d, { title: '覆盖' }).ok).toBe(false)
  expect(value(parsePayload(d.rawText))).toEqual({ aps: { alert: '直接字符串' }, custom: { x: 1 } })
})
it('非法 JSON 保留原文并拒绝切换表单与发送', () => {
  const d = { ...createDraft('android'), mode: 'json' as const, rawText: '{"data":' }
  expect(switchEditor(d, 'form').ok).toBe(false)
  expect(validatePayload(d).ok).toBe(false)
  expect(d.rawText).toBe('{"data":')
})
it('拒绝深层原型污染键和 FCM 路由字段', () => {
  expect(parsePayload('{"data":{"__proto__":{"polluted":true}}}').ok).toBe(false)
  for (const key of ['token', 'topic', 'condition', 'message'])
    expect(validatePayload(raw('android', { [key]: 'x', data: { a: 'b' } })).ok).toBe(false)
  expect(({} as any).polluted).toBeUndefined()
})
it('FCM data 值必须是字符串', () => {
  expect(validatePayload(raw('android', { data: { count: 1 } })).ok).toBe(false)
})
it('APNs 后台消息映射类型与优先级，token 只在路径中', () => {
  const d = value(switchMessageType(createDraft('ios'), 'data'))
  const r = value(
    buildPreview(config, {
      scope: { platform: 'ios', environment: 'test', bundleId: 'com.example' },
      configRevision: 1,
      token: 'a'.repeat(64),
      draft: d,
    }),
  )
  expect(r.body).toEqual({ aps: { 'content-available': 1 } })
  expect(r.headers['apns-push-type']).toBe('background')
  expect(r.headers['apns-priority']).toBe('5')
  expect(r.url).toBe('https://api.sandbox.push.apple.com/3/device/' + 'a'.repeat(64))
  expect(JSON.stringify(r.body)).not.toContain('a'.repeat(64))
})
it('APNs 4096 字节通过，4097 字节被拒绝，含 emoji 正确计量', () => {
  const base = { aps: { alert: { title: '中文🙂' } }, x: '' }
  const size = new TextEncoder().encode(JSON.stringify(base)).length
  expect(validatePayload(raw('ios', { ...base, x: 'a'.repeat(4096 - size) })).ok).toBe(true)
  expect(validatePayload(raw('ios', { ...base, x: 'a'.repeat(4097 - size) })).ok).toBe(false)
})
it('原始后台 JSON 不被旧通知类型重写，冲突优先级被拒绝', () => {
  const d = raw('ios', { aps: { 'content-available': 1 }, custom: 1 })
  expect(
    value(
      buildPreview(config, {
        scope: { platform: 'ios', environment: 'production', bundleId: 'com.example' },
        configRevision: 1,
        token: 'ab',
        draft: d,
      }),
    ).headers['apns-priority'],
  ).toBe('5')
  expect(validatePayload({ ...d, advanced: { priority: 10 } }).ok).toBe(false)
})
it('高级参数按路径合并，TTL 超范围与过长 collapse id 拒绝', () => {
  let d = value(patchForm(createDraft('android'), { androidPriority: 'high', ttl: 30, channelId: 'general' }))
  expect(value(validatePayload(d)).android).toEqual({
    priority: 'high',
    ttl: '30s',
    notification: { channel_id: 'general' },
  })
  expect(patchForm(d, { ttl: 2419201 }).ok).toBe(false)
  expect(patchForm(createDraft('ios'), { collapseId: '中'.repeat(22) }).ok).toBe(false)
})
it('最终 FCM 预览包装目标但不能包含实际鉴权值', () => {
  const d = createDraft('android')
  const p = value(
    buildPreview(config, {
      scope: {
        platform: 'android',
        environment: 'test',
        packageName: 'com.example',
        projectId: 'my-project',
      },
      configRevision: 1,
      token: 'device-token',
      draft: d,
    }),
  )
  expect((p.body.message as any).token).toBe('device-token')
  expect(p.headers.Authorization).toContain('隐藏')
  expect(p.url).toBe('https://fcm.googleapis.com/v1/projects/my-project/messages:send')
})
it('清空高级字段恢复缺省，非法自定义数据不能使用旧的合法预览', () => {
  let d = value(patchForm(createDraft('android'), { ttl: 30 }))
  d = value(patchForm(d, { ttl: null }))
  expect((value(validatePayload(d)).android as any)?.ttl).toBeUndefined()
  expect(validatePayload({ ...d, messageType: 'mixed', formStash: { dataEditorText: '{' } }).ok).toBe(false)
})
