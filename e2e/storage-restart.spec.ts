import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { launch, profile, cleanup, configure } from './helpers'
test('真实加密保存 token 与非法 JSON，立即退出再打开不丢失', async () => {
  const root = await profile()
  let app = await launch(root)
  try {
    const { page, privateKey } = await configure(app, root)
    await page.getByLabel('设备 token', { exact: true }).fill('e2e-device-token-secret')
    await page.getByLabel('设备备注').fill('我的测试手机')
    await page.getByRole('button', { name: '保存 token', exact: true }).click()
    await page.getByText('设备 token 已保存').waitFor()
    await page.getByRole('button', { name: '原始 JSON', exact: true }).click()
    await page.locator('.cm-content').fill('{"data":')
    await expect(page.getByRole('alert')).toContainText('JSON 格式错误')
    await page.getByLabel('推送环境').selectOption('production')
    await app.close()
    const encrypted = await readFile(path.join(root, 'state.v1.enc'))
    expect(encrypted.includes(Buffer.from('e2e-device-token-secret'))).toBe(false)
    expect(encrypted.includes(Buffer.from(privateKey))).toBe(false)
    app = await launch(root)
    const restored = await app.firstWindow()
    await expect(restored.getByLabel('推送环境')).toHaveValue('test')
    await expect(restored.locator('.cm-content')).toHaveText('{"data":')
    await expect(restored.getByLabel('设备 token', { exact: true })).toHaveValue('e2e-device-token-secret')
    await expect(restored.getByRole('button', { name: '发送推送' })).toBeDisabled()
  } finally {
    await app.close()
    await cleanup(root)
  }
})
test('系统加密临时不可用不会覆盖原文件，恢复后可以保存', async () => {
  const root = await profile(),
    app = await launch(root)
  try {
    const { page } = await configure(app, root)
    const file = path.join(root, 'state.v1.enc'),
      previous = await readFile(file)
    await app.evaluate(({ safeStorage }) => {
      ;(globalThis as any).originalEncryptionCheck = safeStorage.isAsyncEncryptionAvailable
      safeStorage.isAsyncEncryptionAvailable = async () => false
    })
    const result = await page.evaluate(() =>
      window.pusher.saveDraft({
        platform: 'android',
        revision: 99,
        mode: 'json',
        messageType: 'data',
        rawText: '{"data":{"k":"v"}}',
        lastValidPayload: { data: { k: 'v' } },
        advanced: {},
        formStash: {},
      }),
    )
    expect(result.ok).toBe(false)
    expect(await readFile(file)).toEqual(previous)
    await app.evaluate(({ safeStorage }) => {
      safeStorage.isAsyncEncryptionAvailable = (globalThis as any).originalEncryptionCheck
    })
    await page.getByLabel('消息标题').fill('加密已恢复')
  } finally {
    await app.close()
    await cleanup(root)
  }
})
