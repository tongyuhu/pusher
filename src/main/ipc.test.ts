import { expect, it, vi } from 'vitest'
import { registerIpc } from './ipc'
import { StateStore } from './storage/state-store'
import { ConfigService } from './config/service'
import { TokenService } from './tokens/service'
import { testStore } from '../test/helpers'
it('拒绝非法来源和未定义的导入字段，关闭时释放所有业务通道', async () => {
  const store = await testStore()
  const handlers = new Map<string, Function>()
  let closed!: () => void
  const frame = { url: 'app://pusher/index.html' }
  const webContents = { mainFrame: frame }
  const window = {
    webContents,
    once: (_e: string, fn: () => void) => {
      closed = fn
    },
  }
  const choose = vi.fn(async () => null)
  const ipcMain = {
    handle: (name: string, fn: Function) => handlers.set(name, fn),
    removeHandler: (name: string) => handlers.delete(name),
  }
  registerIpc({
    window,
    ipcMain,
    store,
    configService: new ConfigService(store, choose),
    tokenService: new TokenService(store),
  } as any)
  const good = { sender: webContents, senderFrame: frame }
  expect((await handlers.get('pusher:bootstrap')!({ ...good, sender: {} })).error.code).toBe('FORBIDDEN')
  expect(
    (await handlers.get('pusher:importCredential')!(good, { kind: 'fcm', path: 'C:/secret' })).error.code,
  ).toBe('INVALID_ARGUMENT')
  expect(choose).not.toHaveBeenCalled()
  expect((await handlers.get('pusher:bootstrap')!(good)).value).not.toHaveProperty('credentials')
  closed()
  expect(handlers.size).toBe(0)
})
