import { expect, it } from 'vitest'
import { FcmAuth } from './auth'
it('访问令牌按 credentialId 缓存，临期刷新与失效可清理', async () => {
  let calls = 0,
    now = 0
  const a = new FcmAuth(
    async () => ({ token: 'token-' + ++calls, expiresAt: now + 3600000 }),
    () => now,
  )
  const c: any = { credentialId: 'one', credential: { kind: 'fcm' } }
  expect(await a.get(c, new AbortController().signal)).toBe('token-1')
  expect(await a.get(c, new AbortController().signal)).toBe('token-1')
  expect(await a.get({ ...c, credentialId: 'two' }, new AbortController().signal)).toBe('token-2')
  now = 3590000
  expect(await a.get(c, new AbortController().signal)).toBe('token-3')
  await a.invalidate('one')
  expect(await a.get(c, new AbortController().signal)).toBe('token-4')
})
