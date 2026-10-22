import { expect, test, type ElectronApplication } from '@playwright/test'
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
test('真实编辑器往返 JSON 使用最新数据，Android 类型切换恢复通知渠道', async () => {
  const root = await profile()
  const app = await launch(root)
  try {
    const page = await app.firstWindow()
    await page.getByRole('button', { name: '通知 + 数据', exact: true }).click()
    await page.getByLabel('自定义数据').fill('{')
    await page.getByRole('button', { name: '原始 JSON', exact: true }).click()
    await page
      .locator('.cm-content')
      .fill(JSON.stringify({ notification: { title: 'JSON 新标题' }, data: { key: 'new', added: 'keep' } }))
    await page.getByRole('button', { name: '表单编辑', exact: true }).click()
    await expect(page.getByLabel('自定义数据')).toHaveValue(
      JSON.stringify({ key: 'new', added: 'keep' }, null, 2),
    )
    await expect(page.getByLabel('消息标题')).toHaveValue('JSON 新标题')
    await page.getByText('高级参数', { exact: true }).click()
    await page.getByLabel('通知渠道 ID').fill('important')
    await page.getByRole('button', { name: '纯自定义数据', exact: true }).click()
    await page.getByRole('button', { name: '通知 + 数据', exact: true }).click()
    await expect(page.getByLabel('通知渠道 ID')).toHaveValue('important')
    await page.getByRole('button', { name: 'iOS', exact: true }).click()
    await page.getByRole('button', { name: '通知 + 数据', exact: true }).click()
    await page.getByLabel('自定义数据').fill('{"order":"old","removed":"old"}')
    await page.getByRole('button', { name: '通知消息', exact: true }).click()
    await page.getByRole('button', { name: '原始 JSON', exact: true }).click()
    await page
      .locator('.cm-content')
      .fill(JSON.stringify({ aps: { alert: { title: '新通知' } }, order: 'new', nested: { added: true } }))
    await page.getByRole('button', { name: '表单编辑', exact: true }).click()
    await page.getByRole('button', { name: '通知 + 数据', exact: true }).click()
    await expect(page.getByLabel('自定义数据')).toHaveValue(
      JSON.stringify({ order: 'new', nested: { added: true } }, null, 2),
    )
  } finally {
    await app.close()
    await cleanup(root)
  }
})
test('同一配置目录重复启动只激活原窗口，不能创建第二个写入进程', async () => {
  const root = await profile()
  const first = await launch(root)
  let second: ElectronApplication | undefined
  try {
    const page = await first.firstWindow()
    await page.getByLabel('消息标题').fill('原窗口内容应保留')
    await first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize())
    try {
      second = await launch(root)
    } catch (error) {
      expect(String(error)).toMatch(/Process failed to launch|Target.*closed/)
    }
    expect(second, '同一目录的第二进程必须在打开窗口前退出').toBeUndefined()
    await expect
      .poll(() => first.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()))
      .toBe(false)
    await expect(page.getByLabel('消息标题')).toHaveValue('原窗口内容应保留')
  } finally {
    if (second) await second.close()
    await first.close()
    await cleanup(root)
  }
})
