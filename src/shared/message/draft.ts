import type { Draft, Platform, JsonObject } from '../contracts'
export function createDraft(platform: Platform): Draft {
  const payload: JsonObject =
    platform === 'android'
      ? { notification: { title: '推送测试', body: '这是一条测试消息' } }
      : { aps: { alert: { title: '推送测试', body: '这是一条测试消息' } } }
  return {
    platform,
    revision: 0,
    mode: 'form',
    messageType: 'notification',
    rawText: JSON.stringify(payload, null, 2),
    lastValidPayload: payload,
    advanced: {},
    formStash: {},
  }
}
