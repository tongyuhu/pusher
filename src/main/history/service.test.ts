import { expect, it } from 'vitest'
import { HistoryService } from './service'
import { testStore } from '../../test/helpers'
import type { SendSnapshot } from '../../shared/contracts'
const snapshot = (id: string): SendSnapshot => ({
  id,
  scope: { platform: 'ios', environment: 'test', bundleId: 'com.example' },
  configRevision: 1,
  token: 'aabb',
  request: {
    method: 'POST',
    url: 'https://example.test',
    headers: {},
    body: { aps: { alert: '测试' } },
    estimatedBytes: 10,
  },
  startedAt: '2026-10-22T00:00:00.000Z',
})
it('同一毫秒 101 条裁剪最旧记录，并去重保存 token', async () => {
  const store = await testStore(),
    h = new HistoryService(store)
  for (let i = 0; i < 101; i++) await h.start(snapshot(String(i)))
  const list = await h.list()
  expect(list).toHaveLength(100)
  expect(list[0].snapshot.id).toBe('100')
  expect(list.at(-1)?.snapshot.id).toBe('1')
  expect((await store.read()).tokens).toHaveLength(1)
})
it('启动恢复将中断发送标记为未知，不影响已完成记录', async () => {
  const store = await testStore(),
    h = new HistoryService(store)
  await h.start(snapshot('a'))
  await h.start(snapshot('b'))
  await h.finish({ snapshot: snapshot('b'), status: 'accepted', elapsedMs: 5, persisted: true })
  await h.recoverInterrupted()
  expect((await h.list()).map((x) => x.status)).toEqual(['accepted', 'unknown'])
})
