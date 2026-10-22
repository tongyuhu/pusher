import { expect, it } from 'vitest'
import { FcmAdapter } from './adapter'
import { DispatchFailure } from '../errors'
const ctx: any = {
  snapshot: {
    id: 'id',
    scope: {
      platform: 'android',
      environment: 'test',
      projectId: 'test-project',
      packageName: 'com.example',
    },
    token: 'device-token',
  },
  resolved: {
    credentialId: 'one',
    credential: {
      kind: 'fcm',
      projectId: 'test-project',
      clientEmail: 'test@example.test',
      privateKey: 'private-secret',
    },
  },
  payload: { data: { type: 'test' } },
}
it('固定目标、注入 token 和鉴权，正确读取服务消息名', async () => {
  const requests: any[] = []
  const a = new FcmAdapter(
    {
      request: async (r: any) => {
        requests.push(r)
        return { status: 200, headers: {}, body: '{"name":"projects/test/messages/123"}' }
      },
    },
    { get: async () => 'oauth-secret', invalidate: async () => {} } as any,
  )
  const r = await a.send(ctx, new AbortController().signal)
  expect(r.status).toBe('accepted')
  expect(r.providerId).toBe('projects/test/messages/123')
  expect(requests).toHaveLength(1)
  expect(requests[0].url).toBe('https://fcm.googleapis.com/v1/projects/test-project/messages:send')
  expect(JSON.parse(requests[0].body.toString())).toEqual({
    message: { data: { type: 'test' }, token: 'device-token' },
  })
  expect(requests[0].headers.Authorization).toBe('Bearer oauth-secret')
})
it.each([401, 403, 429, 503])('HTTP %i 明确拒绝且只发送一次', async (status) => {
  let calls = 0
  const a = new FcmAdapter(
    {
      request: async () => {
        calls++
        return {
          status,
          headers: {},
          body: JSON.stringify({
            error: { status: 'UNAVAILABLE', details: [{ errorCode: 'UNREGISTERED' }] },
          }),
        }
      },
    },
    { get: async () => 'token', invalidate: async () => {} } as any,
  )
  const r = await a.send(ctx, new AbortController().signal)
  expect(r.status).toBe('rejected')
  expect(r.providerCode).toBe('UNREGISTERED')
  expect(calls).toBe(1)
})
it('发出后断线和 200 非 JSON 均为未知，不重发', async () => {
  for (const scenario of ['disconnect', 'malformed']) {
    let calls = 0
    const a = new FcmAdapter(
      {
        request: async () => {
          calls++
          if (scenario === 'disconnect') throw new DispatchFailure('may-have-been-sent', 'ECONNRESET')
          return { status: 200, headers: {}, body: 'not json' }
        },
      },
      { get: async () => 'token', invalidate: async () => {} } as any,
    )
    expect((await a.send(ctx, new AbortController().signal)).status).toBe('unknown')
    expect(calls).toBe(1)
  }
})
it('鉴权期间取消不得继续发推送', async () => {
  const control = new AbortController()
  let calls = 0
  const a = new FcmAdapter(
    {
      request: async () => {
        calls++
        throw Error()
      },
    },
    {
      get: async () => {
        control.abort()
        return 'token'
      },
      invalidate: async () => {},
    } as any,
  )
  expect((await a.send(ctx, control.signal)).status).toBe('not-sent')
  expect(calls).toBe(0)
})
it('服务错误回显访问令牌时不会将它返回界面', async () => {
  const a = new FcmAdapter(
    {
      request: async () => ({
        status: 403,
        headers: {},
        body: JSON.stringify({ error: { message: 'oauth-secret', status: 'PERMISSION_DENIED' } }),
      }),
    },
    { get: async () => 'oauth-secret', invalidate: async () => {} } as any,
  )
  expect(JSON.stringify(await a.send(ctx, new AbortController().signal))).not.toContain('oauth-secret')
})
