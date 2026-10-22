import { expect, it } from 'vitest'
import { TokenService } from './service'
import { testStore, value } from '../../test/helpers'
import type { Scope } from '../../shared/contracts'
const scope: Scope = { platform: 'ios', environment: 'test', bundleId: 'com.example' }
it('token 去重排序、按环境隔离并记住选择', async () => {
  const store = await testStore()
  let ticks = 0
  const svc = new TokenService(store, () => new Date(1700000000000 + ticks++).toISOString())
  const a = value(await svc.save({ scope, token: ' aa ', note: '手机' }))
  value(await svc.save({ scope, token: 'bb', note: '备用' }))
  value(await svc.save({ scope, token: 'aa', note: '新备注' }))
  expect(value(await svc.list(scope)).map((x) => x.token)).toEqual(['aa', 'bb'])
  expect(value(await svc.list({ ...scope, environment: 'production' }))).toEqual([])
  value(await svc.select({ scope, id: a.id }))
  await svc.markInvalid(scope, 'aa', 'Unregistered')
  expect(value(await svc.list(scope))[0].invalidReason).toBe('Unregistered')
  value(await svc.delete({ scope, id: a.id }))
  expect(Object.values((await store.read()).selections)).not.toContain(a.id)
})
