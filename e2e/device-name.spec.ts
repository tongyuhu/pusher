import { expect, test } from '@playwright/test'
import { launch, profile, cleanup, configure } from './helpers'

test('设备列表改名更新原记录，退出重启后恢复新名称', async () => {
  const root = await profile()
  let app = await launch(root)
  const list = async () =>
    (await app.firstWindow()).evaluate(async () => {
      const result = await window.pusher.listTokens({
        platform: 'android',
        environment: 'test',
        packageName: 'com.example.pusher',
        projectId: 'pusher-test-project',
      })
      return result.ok ? result.value.map((t) => ({ id: t.id, note: t.note, token: t.token })) : []
    })
  try {
    const { page } = await configure(app, root)
    await page.getByLabel('设备 token', { exact: true }).fill('fictional-rename-token')
    await page.getByLabel('设备名称（可选）').fill('旧名称')
    await page.getByRole('button', { name: '保存设备', exact: true }).click()
    await expect.poll(list).toEqual([expect.objectContaining({ note: '旧名称' })])
    const originalId = (await list())[0].id
    await page.getByRole('button', { name: '选择已保存设备' }).click()
    await page.getByRole('button', { name: '修改 旧名称 的名称', exact: true }).click()
    await expect(page.getByLabel('设备名称（可选）')).toBeFocused()
    await page.getByLabel('设备名称（可选）').fill('我的 Android 测试机')
    await page.getByLabel('设备名称（可选）').press('Enter')
    await expect
      .poll(list)
      .toEqual([{ id: originalId, note: '我的 Android 测试机', token: 'fictional-rename-token' }])
    await page.getByRole('button', { name: '选择已保存设备' }).click()
    await expect(page.getByRole('button', { name: /^我的 Android 测试机/ })).toBeVisible()
    await app.close()
    app = await launch(root)
    const restored = await app.firstWindow()
    await expect(restored.getByLabel('设备名称（可选）')).toHaveValue('我的 Android 测试机')
    await expect(restored.getByRole('button', { name: '保存名称', exact: true })).toBeDisabled()
  } finally {
    await app.close()
    await cleanup(root)
  }
})
