import { expect, it } from 'vitest'
import { validateSender } from './ipc-guard'
it('只允许主窗口受信地址及精确开发端口', () => {
  expect(validateSender('app://pusher/index.html', true, 'app://pusher')).toBe(true)
  expect(validateSender('app://pusher/index.html', false, 'app://pusher')).toBe(false)
  expect(validateSender('https://pusher.evil.test', true, 'app://pusher')).toBe(false)
  expect(validateSender('http://localhost:5174', true, 'http://localhost:5173')).toBe(false)
})
