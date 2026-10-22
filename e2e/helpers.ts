import { _electron, type ElectronApplication } from '@playwright/test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { tmpdir } from 'node:os'
import { generateKeyPairSync } from 'node:crypto'
export async function profile() {
  return mkdtemp(path.join(tmpdir(), 'pusher-e2e-'))
}
export async function cleanup(root: string) {
  if (!path.resolve(root).startsWith(path.join(tmpdir(), 'pusher-e2e-'))) throw Error('测试目录不安全')
  await rm(root, { recursive: true, force: true })
}
export async function launch(root: string) {
  const env = { ...process.env }
  delete env.ELECTRON_RUN_AS_NODE
  return _electron.launch({ args: ['.', '--user-data-dir=' + root], env, timeout: 15000 })
}
export async function configure(app: ElectronApplication, root: string) {
  const file = path.join(root, 'fixture-credentials.json'),
    privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
      .privateKey.export({ type: 'pkcs8', format: 'pem' })
      .toString()
  await writeFile(
    file,
    JSON.stringify({
      type: 'service_account',
      project_id: 'pusher-test-project',
      client_email: 'fixture@pusher-test-project.iam.gserviceaccount.com',
      private_key: privateKey,
    }),
  )
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] })
  }, file)
  const page = await app.firstWindow()
  await page.getByRole('link', { name: '设置', exact: true }).click()
  await page.getByRole('tab', { name: 'Android 推送' }).click()
  await page.getByLabel('Android 包名').fill('com.example.pusher')
  await page.getByRole('button', { name: '导入 Firebase 密钥' }).click()
  await page.getByText('凭据已导入，请保存设置。').waitFor()
  await page.getByRole('button', { name: '保存设置', exact: true }).click()
  await page.getByText('设置已保存，下次启动会自动加载。').waitFor()
  await page.getByRole('link', { name: '返回工作台' }).click()
  return { page, privateKey }
}
