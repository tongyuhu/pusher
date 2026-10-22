import { BrowserWindow } from 'electron'
import path from 'node:path'
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({ width: 1180, height: 820, minWidth: 900, minHeight: 680, title: 'Pusher · 推送测试', backgroundColor: '#f5f7fb', autoHideMenuBar: true,
    webPreferences: { preload: path.join(import.meta.dirname, '../preload/index.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true } })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', event => event.preventDefault())
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadURL('app://pusher/index.html')
  return window
}
