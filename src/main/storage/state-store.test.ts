import { afterEach, expect, it } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createCipheriv, createDecipheriv } from 'node:crypto'
import { StateStore } from './state-store'
const dirs: string[] = []
const crypto = {
  async encrypt(text: string) {
    const c = createCipheriv('aes-256-gcm', Buffer.alloc(32, 7), Buffer.alloc(12, 8))
    const bytes = Buffer.concat([c.update(text, 'utf8'), c.final()])
    return Buffer.concat([c.getAuthTag(), bytes])
  },
  async decrypt(bytes: Buffer) {
    const d = createDecipheriv('aes-256-gcm', Buffer.alloc(32, 7), Buffer.alloc(12, 8))
    d.setAuthTag(bytes.subarray(0, 16))
    return Buffer.concat([d.update(bytes.subarray(16)), d.final()]).toString('utf8')
  },
}
async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'pusher-store-'))
  dirs.push(dir)
  return { dir, store: new StateStore(dir, crypto) }
}
afterEach(async () => {
  for (const dir of dirs.splice(0)) {
    if (!path.resolve(dir).startsWith(path.join(tmpdir(), 'pusher-store-'))) throw Error('测试路径无效')
    await rm(dir, { recursive: true, force: true })
  }
})
it('串行更新不丢最后一个版本，重建仓库可恢复', async () => {
  const { dir, store } = await setup()
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      store.update((s) => ({ ...s, config: { ...s.config, revision: i + 1 } })),
    ),
  )
  expect((await store.read()).config.revision).toBe(12)
  expect((await new StateStore(dir, crypto).read()).config.revision).toBe(12)
})
it('加密不可用不覆盖原文件或内存', async () => {
  const { dir, store } = await setup()
  await store.update((s) => ({ ...s, selections: { a: 'sensitive-token' } }))
  const before = await readFile(path.join(dir, 'state.v1.enc'))
  expect(before.toString()).not.toContain('sensitive-token')
  const broken = new StateStore(dir, {
    ...crypto,
    encrypt: async () => {
      throw Error('ENCRYPTION_UNAVAILABLE')
    },
  })
  await expect(broken.update((s) => ({ ...s, lastPlatform: 'ios' }))).rejects.toThrow()
  expect(await readFile(path.join(dir, 'state.v1.enc'))).toEqual(before)
  expect((await broken.read()).lastPlatform).toBe('android')
})
it('替换失败保留上一版本', async () => {
  const { dir, store } = await setup()
  await store.update((s) => s)
  const previous = await readFile(path.join(dir, 'state.v1.enc'))
  const failing = new StateStore(dir, crypto, async () => {
    throw Error('rename failed')
  })
  await expect(failing.update((s) => ({ ...s, lastPlatform: 'ios' }))).rejects.toThrow('rename failed')
  expect(await readFile(path.join(dir, 'state.v1.enc'))).toEqual(previous)
})
it('损坏与未知版本不能被空数据覆盖', async () => {
  const { dir } = await setup()
  await writeFile(path.join(dir, 'state.v1.enc'), 'corrupt')
  await expect(new StateStore(dir, crypto).read()).rejects.toThrow()
  await writeFile(path.join(dir, 'state.v1.enc'), await crypto.encrypt('{"schemaVersion":99}'))
  await expect(new StateStore(dir, crypto).read()).rejects.toThrow('版本')
})
it('flush 等待全部待写入操作', async () => {
  const { store } = await setup()
  void store.update((s) => ({ ...s, lastPlatform: 'ios' }))
  await store.flush()
  expect((await store.read()).lastPlatform).toBe('ios')
})
