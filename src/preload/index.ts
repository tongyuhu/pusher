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
const closeListeners = new Set<() => Promise<void>>()
ipcRenderer.on(channel('flush'), async (_event, nonce: string) => {
  try {
    await Promise.all([...closeListeners].map((listener) => listener()))
    ipcRenderer.send(channel('flushAck'), { nonce, ok: true })
  } catch {
    ipcRenderer.send(channel('flushAck'), { nonce, ok: false })
  }
})
api.onBeforeClose = (listener: () => Promise<void>) => {
  closeListeners.add(listener)
  return () => closeListeners.delete(listener)
}
contextBridge.exposeInMainWorld('pusher', api as unknown as PusherApi)
