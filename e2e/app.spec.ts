import { expect, test } from '@playwright/test'
import { launch, profile, cleanup } from './helpers'
test('真实窗口隔离 Node、最小尺寸可操作，双配置目录互不影响', async () => {
  const a = await profile(),
    b = await profile()
  const first = await launch(a),
    second = await launch(b)
  try {
    for (const app of [first, second]) {
      const page = await app.firstWindow()
      await expect(page.getByLabel('推送环境')).toHaveValue('test')
      expect(await page.evaluate(() => typeof (window as any).require)).toBe('undefined')
      await expect(page.getByRole('button', { name: '发送推送' })).toBeDisabled()
    }
    const page = await first.firstWindow()
    await first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(900, 680))
    await page.getByRole('button', { name: '隐藏预览' }).click()
    await expect(page.getByLabel('请求预览')).not.toBeVisible()
    await page.getByRole('button', { name: '显示预览' }).click()
    await expect(page.getByLabel('请求预览')).toBeVisible()
    await page.getByLabel('消息标题').fill('只有第一个配置目录')
    await expect((await second.firstWindow()).getByLabel('消息标题')).toHaveValue('推送测试')
  } finally {
    await first.close()
    await second.close()
    await cleanup(a)
    await cleanup(b)
  }
})
