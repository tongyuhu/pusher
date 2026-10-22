import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import path from 'node:path'
import { launch, profile, cleanup } from './helpers'
import { p8, p12Fixture } from '../src/test/credential-fixtures'
test('实际 Electron 可以导入 p8 和带密码的 p12', async () => {
  const root = await profile(),
    app = await launch(root)
  try {
    const p8File = path.join(root, 'fixture.p8'),
      p12File = path.join(root, 'fixture.p12')
    await writeFile(p8File, p8())
    await writeFile(p12File, p12Fixture())
    await app.evaluate(
      ({ dialog }, files) => {
        dialog.showOpenDialog = async (_window: any, options: any) => ({
          canceled: false,
          filePaths: [options.filters[0].extensions[0] === 'p8' ? files.p8 : files.p12],
        })
      },
      { p8: p8File, p12: p12File },
    )
    const page = await app.firstWindow()
    await page.getByRole('link', { name: '设置', exact: true }).click()
    await page.getByRole('tab', { name: 'iOS 推送' }).click()
    await page.getByLabel('Bundle ID').fill('com.example.pusher')
    await page.getByLabel('Key ID').fill('KEY1234567')
    await page.getByLabel('Team ID').fill('TEAM123456')
    await page.getByRole('button', { name: '导入 .p8 密钥' }).click()
    await page.getByText('凭据已导入，请保存设置。').waitFor()
    await page.getByRole('button', { name: '保存设置', exact: true }).click()
    await page.getByText('设置已保存，下次启动会自动加载。').waitFor()
    await page.getByLabel('鉴权方式').selectOption('p12')
    await page.getByLabel('证书密码').fill('secret')
    await page.getByRole('button', { name: '导入 .p12 证书' }).click()
    await page.getByText('凭据已导入，请保存设置。').waitFor()
    await expect(page.getByText('有效期至：', { exact: false })).toContainText('2040')
    await page.getByRole('button', { name: '保存设置', exact: true }).click()
    await page.getByText('设置已保存，下次启动会自动加载。').waitFor()
  } finally {
    await app.close()
    await cleanup(root)
  }
})
test('异常中断的发送在启动时恢复为未知，而非自动重发', async () => {
  const root = await profile()
  let app = await launch(root)
  try {
    const page = await app.firstWindow()
    await page.getByLabel('消息标题').waitFor()
    await app.evaluate(async ({ app, safeStorage }) => {
      const fs = process.getBuiltinModule('fs/promises'),
        path = process.getBuiltinModule('path')
      const file = path.join(app.getPath('userData'), 'state.v1.enc')
      const decoded = await safeStorage.decryptStringAsync(await fs.readFile(file)),
        state = JSON.parse(decoded.result)
      state.history = [
        {
          snapshot: {
            id: 'interrupted',
            scope: { platform: 'ios', environment: 'production', bundleId: 'com.example' },
            configRevision: 0,
            token: 'aabb',
            request: {
              method: 'POST',
              url: 'https://api.push.apple.com/3/device/aabb',
              headers: {},
              body: { aps: { alert: '测试' } },
              estimatedBytes: 24,
            },
            startedAt: new Date().toISOString(),
          },
          status: 'sending',
          elapsedMs: 0,
          persisted: true,
        },
      ]
      await fs.writeFile(file, await safeStorage.encryptStringAsync(JSON.stringify(state)))
    })
    await app.close()
    app = await launch(root)
    const restored = await app.firstWindow()
    await expect(restored.getByText('发送状态未知', { exact: false })).toBeVisible()
    await expect(restored.getByLabel('推送环境')).toHaveValue('test')
    await expect(restored.getByRole('button', { name: '发送推送' })).toBeDisabled()
  } finally {
    await app.close()
    await cleanup(root)
  }
})
