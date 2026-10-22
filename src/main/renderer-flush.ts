import { randomUUID } from 'node:crypto'
import type { BrowserWindow, IpcMain, IpcMainEvent } from 'electron'
import { channel } from '../shared/channels'
import { validateSender } from './ipc-guard'
export async function requestRendererFlush(
  window: BrowserWindow,
  ipcMain: Pick<IpcMain, 'on' | 'removeListener'>,
  allowedOrigin: string,
): Promise<void> {
  if (window.isDestroyed()) return
  const nonce = randomUUID()
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      ipcMain.removeListener(channel('flushAck'), ack)
    }
    const ack = (event: IpcMainEvent, value: unknown) => {
      const data = value as { nonce?: string; ok?: boolean } | null
      if (
        event.sender !== window.webContents ||
        !validateSender(
          event.senderFrame?.url || '',
          event.senderFrame === window.webContents.mainFrame,
          allowedOrigin,
        ) ||
        data?.nonce !== nonce
      )
        return
      cleanup()
      if (data.ok === true) resolve()
      else reject(Error('CLOSE_CANCELLED'))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(Error('FLUSH_TIMEOUT'))
    }, 5000)
    ipcMain.on(channel('flushAck'), ack)
    window.webContents.send(channel('flush'), nonce)
  })
}
