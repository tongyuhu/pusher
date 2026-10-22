import { EventEmitter } from 'node:events'
import { afterEach, expect, it, vi } from 'vitest'
import { requestRendererFlush } from './renderer-flush'
afterEach(() => vi.useRealTimers())
it('只接受对应窗口当前 nonce 的确认，并释放监听', async () => {
  const ipc = new EventEmitter(),
    frame = { url: 'app://pusher/index.html' }
  let nonce = ''
  const contents = {
    mainFrame: frame,
    send: (_channel: string, n: string) => {
      nonce = n
    },
  }
  const window = { webContents: contents, isDestroyed: () => false }
  let done = false
  const promise = requestRendererFlush(window as any, ipc as any, 'app://pusher').then(() => (done = true))
  ipc.emit('pusher:flushAck', { sender: {}, senderFrame: frame }, { nonce, ok: true })
  await Promise.resolve()
  expect(done).toBe(false)
  ipc.emit('pusher:flushAck', { sender: contents, senderFrame: frame }, { nonce: 'wrong', ok: true })
  await Promise.resolve()
  expect(done).toBe(false)
  ipc.emit('pusher:flushAck', { sender: contents, senderFrame: frame }, { nonce, ok: true })
  await promise
  expect(done).toBe(true)
  expect(ipc.listenerCount('pusher:flushAck')).toBe(0)
})
it('未响应的窗口 5 秒后取消关闭，不能丢弃未保存状态', async () => {
  vi.useFakeTimers()
  const ipc = new EventEmitter(),
    window = { webContents: { send() {} }, isDestroyed: () => false }
  const promise = requestRendererFlush(window as any, ipc as any, 'app://pusher')
  const expected = expect(promise).rejects.toThrow('FLUSH_TIMEOUT')
  await vi.advanceTimersByTimeAsync(5000)
  await expected
  expect(ipc.listenerCount('pusher:flushAck')).toBe(0)
})
