import { app, protocol, net, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { createMainWindow, rendererUrl } from './window'
import { resolveAssetPath } from './protocol'
import { StateStore } from './storage/state-store'
import { electronCrypto } from './storage/electron-crypto'
import { ConfigService } from './config/service'
import { TokenService } from './tokens/service'
import { registerIpc } from './ipc'
import { installShutdownFlush } from './lifecycle'
import { HistoryService } from './history/service'
import { SendCoordinator } from './send/coordinator'
import { FcmAdapter } from './push/fcm/adapter'
import { ApnsAdapter } from './push/apns/adapter'
import { channel } from '../shared/channels'
import { requestRendererFlush } from './renderer-flush'
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])
const requestedData = app.commandLine.getSwitchValue('user-data-dir')
if (requestedData) app.setPath('userData', path.resolve(requestedData))
void app
  .whenReady()
  .then(async () => {
    protocol.handle('app', (request) => {
      const resolved = resolveAssetPath(request.url, path.join(import.meta.dirname, '../renderer'))
      return resolved.ok
        ? net.fetch(pathToFileURL(resolved.value).toString())
        : new Response('资源不可用', { status: 403 })
    })
    const window = createMainWindow()
    const store = new StateStore(app.getPath('userData'), electronCrypto)
    const configService = new ConfigService(store, async (kind) => {
      const file = await dialog.showOpenDialog(window, {
        title: '导入推送凭据',
        properties: ['openFile'],
        filters: [
          { name: '推送凭据', extensions: [kind === 'fcm' ? 'json' : kind === 'apns-p8' ? 'p8' : 'p12'] },
        ],
      })
      if (file.canceled || !file.filePaths[0]) return null
      return { fileName: path.basename(file.filePaths[0]), bytes: await readFile(file.filePaths[0]) }
    })
    await configService.cleanupUnreferenced().catch(() => {})
    const tokenService = new TokenService(store),
      history = new HistoryService(store),
      fcm = new FcmAdapter(),
      apns = new ApnsAdapter()
    await history.recoverInterrupted().catch(() => {})
    const coordinator = new SendCoordinator({
      store,
      configService,
      history,
      tokenService,
      adapters: { android: fcm, ios: apns },
    })
    configService.onInvalidate = async (id) => {
      await Promise.all([fcm.invalidate(id), apns.invalidate(id)])
    }
    coordinator.onUpdate((receipt) => {
      if (!window.isDestroyed()) window.webContents.send(channel('sendUpdate'), receipt)
    })
    registerIpc({
      window,
      ipcMain,
      store,
      configService,
      tokenService,
      send: (input) => coordinator.send(input),
      allowedOrigin: rendererUrl() || 'app://pusher',
    })
    let allowClose = false
    window.on('close', (event) => {
      if (!allowClose) {
        event.preventDefault()
        app.quit()
      }
    })
    installShutdownFlush(
      app,
      async () => {
        await requestRendererFlush(window, ipcMain, rendererUrl() || 'app://pusher')
        await store.flush()
        await apns.close()
        allowClose = true
      },
      (error) => {
        window.show()
        if (!(error instanceof Error && error.message === 'CLOSE_CANCELLED'))
          dialog.showErrorBox('保存未完成', '草稿尚未保存或窗口未响应，请检查后重试关闭。')
      },
    )
    app.on('window-all-closed', () => app.quit())
  })
  .catch(() => dialog.showErrorBox('启动失败', 'Pusher 未能完成初始化，请重新启动。'))
