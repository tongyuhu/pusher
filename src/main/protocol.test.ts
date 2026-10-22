import { expect, it } from 'vitest'
import { resolveAssetPath } from './protocol'
it('限定资源路径在打包目录内', () => {
  expect(resolveAssetPath('app://pusher/index.html', 'C:/app/renderer').ok).toBe(true)
  expect(resolveAssetPath('app://other/index.html', 'C:/app/renderer').ok).toBe(false)
  expect(resolveAssetPath('app://pusher/%2e%2e%2fsecret', 'C:/app/renderer').ok).toBe(false)
})
