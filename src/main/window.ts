import { app, BrowserWindow } from 'electron'
import path from 'node:path'
export function createMainWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 900,
    minHeight: 680,
    title: 'Pusher · 推送测试',
    backgroundColor: '#f5f7fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(import.meta.dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  if (rendererUrl()) void window.loadURL(rendererUrl()!)
  else void window.loadURL('app://pusher/index.html')
  return window
}
export function rendererUrl(): string | undefined {
  const raw = !app.isPackaged ? process.env.ELECTRON_RENDERER_URL : undefined
  if (!raw) return
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(u.hostname)) return raw
  } catch {}
  return
}
