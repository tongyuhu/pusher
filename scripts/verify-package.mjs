import { listPackage } from '@electron/asar'
const archive = process.argv[2] || 'release/win-unpacked/resources/app.asar'
const files = listPackage(archive)
const forbidden = files
  .map((p) => p.replaceAll('\\', '/'))
  .filter(
    (p) =>
      /\/(\.superpowers|e2e|__tests__|node-forge)(\/|$)/.test(p) ||
      /\.(test|spec)\.[jt]sx?$|\.map$|fixture-credentials/.test(p),
  )
if (forbidden.length) {
  console.error('发布归档包含开发或测试文件：', forbidden)
  process.exit(1)
}
console.log(`发布归档检查通过：${files.length} 个条目，无头脑风暴会话、测试代码、测试凭据或 node-forge。`)
