# Pusher

一个在本机运行的 iOS / Android 推送测试工具，使用 Electron、React 和 TypeScript 开发。

主页面采用双栏布局：左侧选择设备 token、编辑消息；右侧核对请求、查看服务响应和最近发送记录。应用配置位于独立设置页。

## 使用方式

本次 0.1.1 安装包位于 `release/0.1.1/`，也可以直接运行 `release/0.1.1/win-unpacked/Pusher.exe`。更新前先正常退出旧版本；同一用户目录只允许一个实例运行。现有加密配置与设备记录继续使用。

1. 打开工具，进入右上角「设置」。
2. 配置应用名称，以及当前平台、环境对应的推送凭据，点击「保存设置」。
3. 回到工作台，选择 Android 或 iOS。默认进入测试环境，可以手动切换生产环境。
4. 粘贴设备 token，填写「设备名称（可选）」并点击「保存设备」；也可以从下拉历史中选择。
5. 使用表单或原始 JSON 编辑消息，核对右侧请求预览后发送。

配置、凭据、token、草稿和最近 100 条发送记录保存在本机。进入设置再返回会保留消息内容；正常退出前会刷新尚未保存的草稿。

修改设备名称：在设备下拉列表点击铅笔按钮，修改名称后点击「保存名称」，也可以按 Enter 保存。更新的是同一条设备记录；列表刷新不会覆盖正在编辑的名称。名称需要手动保存后才会在重启时恢复。

界面与应用图标使用 Lucide；原始许可文本见 [第三方许可声明](THIRD_PARTY_NOTICES.md)，声明随安装包分发。

## 推送配置

### Android：Firebase FCM

进入 Firebase 控制台的「项目设置 → 服务账号」，生成并下载服务账号私钥 JSON，然后在工具的 Android 设置中导入。

此文件包含 `type: "service_account"`、`project_id`、`client_email` 和 `private_key`。Android App 使用的 `google-services.json` 不是服务端推送凭据。

测试和生产各有独立配置，分别选择对应的 Firebase 项目。也允许两环境配置同一项目；工具不会根据“测试环境”文字自动切换到另一台 FCM 服务器。

### iOS：Apple APNs

支持两种鉴权方式：

| 方式 | 所需内容 |
| --- | --- |
| `.p8` 签名密钥 | `.p8` 文件、Key ID、Team ID、Bundle ID |
| `.p12` 推送证书 | 包含匹配私钥的证书文件、证书密码、Bundle ID |

Key ID 与 Team ID 分别填写 10 位标识。证书密码允许为空；导入时检查文件格式和证书有效期。如果原生 TLS 不支持旧证书的加密格式，需要重新导出兼容的 PKCS#12 文件。

iOS 测试环境使用 APNs sandbox，生产环境使用 APNs production。请按安装包实际使用的 APNs 环境选择，不要仅根据 App 的业务环境名称判断。

导入成功只表示本地解析通过。服务端权限、环境和设备 token 是否匹配，需要以实际发送响应和设备表现确认。

## 消息编辑

表单支持通知、纯自定义数据、通知加数据。iOS 的纯自定义数据映射为后台通知，包含 `aps.content-available = 1`，使用 background 类型和优先级 5；后台执行仍取决于 App 能力与系统调度。

JSON 编辑器填写平台消息内容；目标 token、项目、环境和鉴权由工具补充。

FCM 示例：

```json
{
  "notification": {
    "title": "推送测试",
    "body": "这是一条测试消息"
  },
  "data": {
    "type": "test"
  }
}
```

不需要在编辑器中加入 `message` 包装或 `token`、`topic`、`condition` 字段。`data` 的值必须是字符串。右侧显示最终拼装的 HTTP v1 消息体。

APNs 示例：

```json
{
  "aps": {
    "alert": {
      "title": "推送测试",
      "body": "这是一条测试消息"
    },
    "sound": "default"
  },
  "type": "test"
}
```

JSON 与表单切换时保留扩展字段；表单无法表示的 alert 结构由 JSON 管理。非法 JSON 会保存原文，但阻止发送和切回表单。APNs 普通消息体上限为 4096 个 UTF-8 字节；FCM 显示估算体积，最终限制以服务响应为准。

## 发送结果

- **服务已接受**：FCM/APNs 接受了请求，并返回消息名称或 APNs ID。设备是否实际收到，需在 App 或设备日志中确认。
- **服务已拒绝**：显示 HTTP 状态、服务错误码和经过脱敏的详情。
- **未能发送**：可以确认推送请求未发出，例如鉴权失败或连接未建立。
- **发送状态未知**：请求可能已发出后超时、断线，或发送期间工具退出。先核对设备，再决定是否重试。

业务推送不会自动重发，总网络发送期限为 30 秒，包含获取访问令牌的时间。历史记录可以查看快照或载入重新编辑；载入不会自动发送或切换到生产环境。

## 本地数据

凭据、token、草稿和历史内容通过 Electron safeStorage 加密，数据文件为用户数据目录下的 `state.v1.enc`。默认目录：

- Windows：`%APPDATA%\Pusher`
- macOS：`~/Library/Application Support/Pusher`

加密能力与本机用户身份绑定，不提供跨机器迁移。导入后已保存加密副本，移动或删除原下载文件不影响工具使用。系统加密暂时不可用时会保留原文件并提示重试，不降级成明文。

token 历史按平台、环境和应用身份分别保存。修改显示名称或更换同项目密钥不改变命名空间；更换包名、Bundle ID 或 Firebase 项目后不会自动沿用旧 token。

## 开发与验证

需要 Node.js 22.12 或更高的兼容 LTS，使用 npm 和仓库中的锁文件。

```powershell
npm ci
npm run dev
```

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e
```

集成测试使用真实 Electron 进程、隔离的临时数据目录以及自动生成的虚构凭据，不连接真实推送服务。

## 打包

```powershell
npm run pack
npm run verify:package
npm run dist:win
```

如果旧版发布目录中的程序仍在运行，可以将本次构建输出到独立目录：

```powershell
npm run dist:win -- --config.directories.output=release/0.1.1
npm run verify:package -- release/0.1.1/win-unpacked/resources/app.asar
```

在 macOS 上分别构建两个架构：

```sh
npm ci
npm run dist:mac:x64
npm run dist:mac:arm64
```

当前构建未配置正式代码签名，macOS 默认不自动选择签名身份。正式分发的签名和公证需要开发者凭据。命令均不会上传或发布安装包。

实际完成的验证与待验证项目见 [验证记录](docs/verification.md)，设计和实施计划位于 `docs/superpowers/`。
