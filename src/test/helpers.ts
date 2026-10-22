import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach } from 'vitest'
import { StateStore } from '../main/storage/state-store'
import type { Result } from '../shared/contracts'
const roots: string[] = []
export async function testStore() {
  const root = await mkdtemp(path.join(tmpdir(), 'pusher-test-'))
  roots.push(root)
  return new StateStore(root, {
    encrypt: async (text) => Buffer.from(text).reverse(),
    decrypt: async (bytes) => Buffer.from(bytes).reverse().toString(),
  })
}
afterEach(async () => {
  for (const root of roots.splice(0)) {
    if (!path.resolve(root).startsWith(path.join(tmpdir(), 'pusher-test-'))) throw Error('无效测试路径')
    await rm(root, { recursive: true, force: true })
  }
})
export function value<T>(r: Result<T>): T {
  if (!r.ok) throw Error(r.error.code + ':' + r.error.message)
  return r.value
}
