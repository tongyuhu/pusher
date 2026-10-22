import { contextBridge, ipcRenderer } from 'electron'
import type { PusherApi, SendReceipt } from '../shared/contracts'
import { CHANNELS, channel } from '../shared/channels'
const api: Record<string, unknown> = {}
for (const name of CHANNELS) api[name] = (input: unknown) => ipcRenderer.invoke(channel(name), input)
api.onSendUpdate = (listener: (receipt: SendReceipt) => void) => {
  const wrapped = (_event: unknown, receipt: SendReceipt) => listener(receipt)
  ipcRenderer.on(channel('sendUpdate'), wrapped)
  return () => ipcRenderer.removeListener(channel('sendUpdate'), wrapped)
}
api.onBeforeClose = (listener: () => Promise<void>) => {
  const wrapped = async (_event: unknown, nonce: string) => {
    try { await listener(); ipcRenderer.send(channel('flushAck'), { nonce, ok: true }) }
    catch { ipcRenderer.send(channel('flushAck'), { nonce, ok: false }) }
  }
  ipcRenderer.on(channel('flush'), wrapped)
  return () => ipcRenderer.removeListener(channel('flush'), wrapped)
}
contextBridge.exposeInMainWorld('pusher', api as unknown as PusherApi)
