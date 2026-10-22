import { app, protocol, net, ipcMain } from 'electron'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { createMainWindow } from './window'
import { resolveAssetPath } from './protocol'
import { validateSender } from './ipc-guard'
import { CHANNELS, channel } from '../shared/channels'
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
await app.whenReady()
protocol.handle('app', request => {
  const resolved = resolveAssetPath(request.url, path.join(import.meta.dirname, '../renderer'))
  return resolved.ok ? net.fetch(pathToFileURL(resolved.value).toString()) : new Response('资源不可用', { status: 403 })
})
const window = createMainWindow()
for (const method of CHANNELS) ipcMain.handle(channel(method), event => {
  const trusted = event.sender === window.webContents && validateSender(event.senderFrame?.url || '', event.senderFrame === window.webContents.mainFrame, process.env.ELECTRON_RENDERER_URL || 'app://pusher')
  return { ok: false, error: { code: trusted ? 'NOT_READY' : 'FORBIDDEN', message: trusted ? '功能正在初始化' : '来源无效', retryable: false } }
})
app.on('window-all-closed', () => app.quit())
