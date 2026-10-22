# Pusher 桌面推送工具实施计划

> **面向执行代理：必需子技能：** 使用 `superpowers:subagent-driven-development` 或 `superpowers:executing-plans` 逐任务实施。本计划推荐当前会话直接执行；执行方式由用户审阅后选择。步骤使用复选框跟踪。

**目标：** 交付 Windows/macOS 上可保存凭据、缓存 token、以表单和 JSON 编辑消息并向单台 iOS/Android 设备发送推送的 Electron 桌面工具。

**架构：** React 只负责界面，经受限 preload 接口调用主进程。主进程统一管理加密存储、配置、发送快照及 APNs/FCM 适配器；消息转换与校验是可独立测试的纯逻辑。所有业务推送禁用隐式重发。

**技术栈：** Electron、React、TypeScript、electron-vite、electron-builder；Zod 校验契约，Google Auth Library 获取 FCM 访问令牌，Node HTTPS/HTTP2/crypto 负责实际传输和签名，node-forge 仅用于 PKCS#12 解析；React Router、CodeMirror 6、CSS；Vitest、Testing Library、Playwright Electron。

**设计依据：** [已确认的设计说明](../specs/2026-10-22-pusher-desktop-design.md)。执行者必须先读本文与设计说明；当前仓库只有设计文件，没有现有应用代码。

## 全局约束

- “运行平台：Windows、macOS”；打包目标 Windows x64、macOS x64 与 arm64。
- “每次启动默认选择测试环境”；生产环境有醒目的文字和颜色标识。
- “单次向一个设备 token 发送；保留最近 100 条发送记录。”
- “默认总发送期限 30 秒，包含鉴权耗时。”
- “任何状态都不自动重发业务推送。”
- “界面默认使用中文。技术字段、原始 JSON 键名和服务返回的错误码保持原文。”
- “渲染进程关闭 Node 集成，启用上下文隔离和沙箱”；主进程验证 IPC 来源及所有业务入参。
- “加密能力临时不可用时提示解锁或重试，不降级为明文保存”。
- APNs 普通消息体上限 4096 个 UTF-8 字节；FCM 显示估算值，最终大小校验以服务响应为准。
- Windows/macOS 的真实加密、安装包和真实推送分别记录证据；缺少环境或凭据的项目标注待验证。
- 根目录为 `C:\Users\1\workspace\pusher`；下述文件均相对该目录。继续使用当前 checkout，执行前核对 Git 状态，不覆盖用户新增修改。
- 依赖统一使用 npm 和 `package-lock.json`。任务 1 才安装依赖，选择执行时最新稳定且彼此兼容的版本，固定直接依赖版本并记录实际 Node/Electron 版本；不使用 beta/canary。
- 开发 Node 基线为 22.12 或更高的兼容 LTS；计划阶段检测到本机 Node 22.22.2、npm 10.9.7。Electron 自带 Node 的 API 能力需按锁定版本验证。
- 每项任务先写有业务意义的失败测试，再实现并验证。纯样式、配置文件不编写镜像测试；通过真实构建和界面检查验证。
- 任务提交精确列出文件；不执行 `git add .`、`git add -A`、跳过检查或推送远端。提交示例即为本计划内的本地提交范围。

## 审查重点

1. 较慢的旧草稿写入不能覆盖较新的内容，正常退出必须等待最后一次保存；任务 2、3、9 固定此行为。
2. 同一项目换密钥不丢 token，显示名称变化不改变身份，切回旧身份能找回历史；任务 4 固定此行为。
3. JSON 中出现 `__proto__`、未知嵌套字段或 APNs 非字符串 alert 时，不污染对象、不静默丢字段；任务 3 固定此行为。
4. 发送期间切换环境或编辑内容，不得改变已经发出的请求或把旧结果展示成新目标的结果；任务 8、9 固定此行为。
5. 请求已经被接受但写记录失败、进程退出或连接断开时，不能显示成可安全自动重试的失败；任务 2、6、7、8、10 固定此行为。

## 文件职责与任务顺序

| 任务 | 主要文件区域 | 独立交付结果 |
| --- | --- | --- |
| 1 | 根配置、`src/shared/`、Electron 入口、preload、React 壳 | 能运行的隔离窗口与可校验契约 |
| 2 | `src/main/storage/`、`src/main/lifecycle.ts` | 加密、串行且原子写入的本地仓库 |
| 3 | `src/shared/message/` | 无损消息编辑、类型映射与请求预览 |
| 4 | `src/main/config/`、`src/main/tokens/`、`src/main/credentials/` | 可导入凭据并隔离目标的配置服务 |
| 5 | `src/renderer/settings/`、`src/renderer/app/`、IPC 业务注册 | 真实设置页和配置恢复 |
| 6 | `src/main/push/fcm/`、HTTPS 传输 | 可替换传输的 FCM 发送 |
| 7 | `src/main/push/apns/`、HTTP/2 传输 | 两种鉴权的 APNs 发送 |
| 8 | `src/main/send/`、`src/main/history/` | 有快照和可靠状态语义的统一发送流程 |
| 9 | `src/renderer/workbench/`、`src/renderer/state/`、样式 | A 双栏首页完整操作链路 |
| 10 | `e2e/`、打包配置、`README.md`、`docs/verification.md` | Windows 产物及双平台验收说明 |

任务顺序为 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10。每项任务末尾做针对性检查；最终统一执行全量检查，不在无变化时重复运行所有检查。

## 共享契约约定

任务 1 在 `src/shared/contracts.ts` 定义下列数据类型与 `PusherApi`，Zod 运行时结构放在 `src/shared/schemas.ts`。后续任务消费相同名称，不自行复制另一套模型。

```ts
type Platform = 'android' | 'ios'
type Environment = 'test' | 'production'
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }
type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }
type Scope =
  | { platform: 'android'; environment: Environment; packageName: string; projectId: string }
  | { platform: 'ios'; environment: Environment; bundleId: string }
type SendStatus = 'sending' | 'accepted' | 'rejected' | 'not-sent' | 'unknown'
```

其他类型的字段在任务 1 固定：`AppError` 为 `{code,message,field?,retryable}`；`CredentialKind` 为 `fcm|apns-p8|apns-p12`；`CredentialSummary` 只含 `{id,kind,fileName,importedAt,projectId?,clientEmail?,expiresAt?}`。

`SettingsInput` 包含 `expectedRevision`、显示名称，以及分别按 test/production 保存的 Android `{packageName,credentialId?}` 和 iOS `{bundleId,authKind:'p8'|'p12',keyId?,teamId?,credentialId?}`。`PublicConfig` 是去掉 `expectedRevision` 后加 `revision` 的已保存设置。允许某个平台/环境未配置，发送时才要求对应配置完整。

`TokenRecord` 包含 `{id,scope,token,note,createdAt,lastUsedAt,invalidReason?}`。`Draft` 包含 `{platform,revision,mode,messageType,rawText,lastValidPayload,advanced,formStash}`，其中 mode 为 `form|json`，messageType 为 `notification|data|mixed`，`advanced` 和 `formStash` 为按平台校验的 `JsonObject`。

`PreviewRequest` 为 `{method,url,headers,body,estimatedBytes}`，`headers` 必须脱敏。`SendInput` 为 `{scope,configRevision,token,draft}`。`SendSnapshot` 为 `{id,scope,configRevision,token,request,startedAt}`；`SendReceipt` 为 `{snapshot,status,elapsedMs,providerId?,httpStatus?,providerCode?,detail?,persisted}`，不返回鉴权材料。`BootstrapSnapshot` 包含 `{config,credentialSummaries,drafts,history,lastPlatform,selections}`，其中 credentialSummaries 只有已引用凭据的公开摘要，selections 是 scopeKey 到 token ID 的映射；初始默认环境由界面固定为 test。

`PusherApi` 所有业务方法返回 `Promise<Result<T>>`：`bootstrap() → BootstrapSnapshot`，`importCredential({kind,password?}) → CredentialSummary|null`，`saveSettings(SettingsInput) → PublicConfig`，`listTokens(Scope) → TokenRecord[]`，`saveToken({scope,token,note}) → TokenRecord`，`deleteToken({scope,id}) → void`，`selectToken({scope,id?}) → void`，`saveDraft(Draft) → void`，`listHistory() → SendReceipt[]`，`send(SendInput) → SendReceipt`。导入取消返回成功的 null。

`onSendUpdate(listener: (receipt: SendReceipt) => void): () => void` 返回取消订阅函数。`onBeforeClose(listener:()=>Promise<void>):()=>void` 仅用于主进程退出时请求 renderer 刷新尚未发出的草稿，并由 preload 回传固定通道的 nonce 确认；不是任意 IPC。以上为全部 renderer 能力，不提供通用 invoke、任意路径读取或私钥解密接口。

### 任务 1：基础工程、隔离窗口与契约

**文件：** 新增 `package.json`、`package-lock.json`、`electron.vite.config.ts`、`tsconfig.json`、`tsconfig.node.json`、`tsconfig.web.json`、`vitest.config.ts`、`src/shared/{contracts,schemas,channels}.ts`、`src/shared/contracts.test.ts`、`src/main/{index,window,protocol,ipc-guard}.ts`、`src/main/{ipc-guard,protocol}.test.ts`、`src/preload/index.ts`、`src/renderer/{index.html,main.tsx,env.d.ts,App.tsx}`、`src/renderer/styles/{tokens,app}.css`、`src/test/setup.ts`。

**接口：** 产出上述契约、`validateSender(frameUrl: string, isMainFrame: boolean, allowedOrigin: string): boolean`、`resolveAssetPath(url:string,root:string):Result<string>`、`createMainWindow(): BrowserWindow`。preload 对每个方法显式绑定固定通道，未实现业务返回 `NOT_READY`，不伪造成功数据。

- [ ] 步骤 1：创建最小 npm/TypeScript/Vitest 配置并锁定依赖；运行 `npm view electron version`、`npm view electron-vite engines peerDependencies --json` 核对兼容性。添加运行依赖 `react`、`react-dom`、`react-router-dom`、`zod`，以及构建与测试开发依赖；后续所需的编辑器和推送依赖在对应任务安装。配置 `dev`、`build`、`typecheck`、`test` 脚本，`test` 固定执行 `vitest run`。
- [ ] 步骤 2：先写契约与 sender 的失败测试。断言 `sendInputSchema.safeParse({scope:{platform:'web'}}).success === false`；`validateSender('app://pusher/index.html',true,'app://pusher') === true`；同源子 frame、其他 origin、形似域名和开发端口不匹配均为 false。protocol 测试确认合法资源可解析，编码后的目录穿越和非 pusher host 无法读取 root 外文件。
- [ ] 步骤 3：运行 `npm test -- src/shared/contracts.test.ts src/main/ipc-guard.test.ts src/main/protocol.test.ts`，确认缺少实现或断言失败，不能以依赖安装失败当作测试失败证据。
- [ ] 步骤 4：实现类型、Zod 校验和窗口。窗口默认 1180×820，最小 900×680；`nodeIntegration:false`、`contextIsolation:true`、`sandbox:true`。打包使用 `app://pusher`，资源路径限定 renderer 目录，拒绝目录穿越；开发仅信任 electron-vite 实际分配的 localhost origin。preload 打为沙箱兼容单包，CSP 不允许远程脚本，外部导航和窗口创建被阻止。
- [ ] 步骤 5：重新运行上述测试和 `npm run typecheck`、`npm run build`，均须退出 0；`npm run dev` 确认中文空状态可见，界面不存在 Node 全局，结束本次检查启动的进程。
- [ ] 步骤 6：精确暂存本任务文件并本地提交 `工程：建立 Electron React 基础与安全契约`，检查无临时文件或预览会话进入提交。

### 任务 2：加密仓库、串行持久化与退出刷新

**文件：** 新增 `src/main/storage/{types,crypto-port,electron-crypto,atomic-file,state-store}.ts`、`src/main/storage/state-store.test.ts`、`src/main/lifecycle.ts`、`src/main/lifecycle.test.ts`；修改 `src/main/index.ts`。

**接口：** `CryptoPort.encrypt(text:string):Promise<Buffer>` / `decrypt(data:Buffer):Promise<string>`；`StateStore.read():Promise<AppState>`、`update(mutator:(current:AppState)=>AppState):Promise<void>`、`flush():Promise<void>`。`AppState` 私有结构含 `schemaVersion:1`、config、credentials、tokens、drafts、history、selections、lastPlatform。`CredentialSecret` 为三种凭据的带 kind 联合，保存原始内容及解析后所需字段，不向 shared 导出。

- [ ] 步骤 1：先写 `serializes_updates_without_losing_newest_value`、`does_not_overwrite_on_crypto_unavailable`、`failed_rename_preserves_previous_state`、`flush_waits_for_pending_writes`。断言并发更新后 revision 为最大值；模拟加密失败时文件仍为原字节；加密文件中不出现测试 token；未知版本与损坏密文报错而非创建空库。
- [ ] 步骤 2：运行 `npm test -- src/main/storage/state-store.test.ts src/main/lifecycle.test.ts`，确认失败点对应缺失存储和生命周期实现。
- [ ] 步骤 3：实现单个加密 `state.v1.enc`，路径来自 `app.getPath('userData')`。所有读改写按队列串行，以同目录唯一临时文件写入后替换；写入失败不更新内存的已保存版本，不泄露明文临时文件。safeStorage 在 app ready 后初始化，按锁定 Electron API 实现 CryptoPort，不可用时返回 `ENCRYPTION_UNAVAILABLE`，不使用明文回退。
- [ ] 步骤 4：实现 `installShutdownFlush(app, flush:()=>Promise<void>):void`，正常退出先等待队列；任务 9 接入 renderer 刷新握手后，顺序为 renderer 待发送草稿→主进程存储队列→退出。握手超过 5 秒或保存失败时取消本次退出、恢复窗口并提示，不无限递归调用 quit。启动只在文件不存在时初始化空库。
- [ ] 步骤 5：重新运行本任务测试与 `npm run typecheck`，确认退出等待、重复 quit 和磁盘失败测试通过；真实 Windows safeStorage 恢复检查留到任务 10 的 Electron 实测。
- [ ] 步骤 6：精确暂存本任务文件并本地提交 `功能：实现加密存储与可靠退出保存`。

### 任务 3：消息模型、无损编辑与请求预览

**文件：** 新增 `src/shared/message/{draft,json,form,fcm,apns,preview}.ts` 及同名 `.test.ts`；修改 `src/shared/{contracts,schemas}.ts`。

**接口：** `parsePayload(raw:string):Result<JsonObject>`、`patchForm(draft:Draft,patch:FormPatch):Result<Draft>`、`switchEditor(draft:Draft,mode:'form'|'json'):Result<Draft>`、`switchMessageType(draft:Draft,type:Draft['messageType']):Result<Draft>`、`validatePayload(draft:Draft):Result<JsonObject>`、`buildPreview(config:PublicConfig,input:SendInput):Result<PreviewRequest>`。`FormPatch` 只包含标题、正文、数据和各平台高级字段，禁止任意对象路径。

- [ ] 步骤 1：先写测试：FCM data 消息没有 notification，混合消息同时具有两者；APNs 后台 `aps['content-available'] === 1`、push-type background、priority 5；表单/JSON 往返保留未知嵌套字段；无法表单化的 alert 不被空字段覆盖；非法 JSON 保留 rawText 并拒绝切换。
- [ ] 步骤 2：补充 `rejects_nested_prototype_keys`、`rejects_fcm_routing_fields`、`apns_limit_uses_utf8_bytes`：用 `JSON.parse('{"data":{"__proto__":{"polluted":true}}}')` 检查拒绝且普通对象未污染；FCM token/topic/condition/message 顶层字段被拒绝；构造消息体恰好 4096 字节通过、4097 字节失败，中文与 emoji 按 UTF-8 计量。
- [ ] 步骤 3：运行 `npm test -- src/shared/message`，确认以上业务断言失败后实现。JSON 采用安全解析和字段路径更新，保留未知合法字段；数组和保留原型键不作为顶层对象。JSON 模式以 rawText 解析结果为权威，不根据旧 messageType 重建；APNs 请求头类型根据实际 aps 的可见字段/后台标记推断，冲突则报错。FormPatch 与 Draft advanced 共用单一字段来源，避免 JSON 和折叠表单双重覆盖；切换类型的暂存内容放入 formStash。
- [ ] 步骤 4：实现三类消息、高级参数与预览。FCM TTL 采用 0～2419200 秒并输出 `Ns`；priority 使用 normal/high。APNs 仅允许 alert/background，后台优先级固定为 5，角标为非负整数，过期时间为非负 UTC 秒，collapse-id 不超过 64 个 UTF-8 字节。禁止冲突参数、非字符串 FCM data 和自定义 aps 覆盖。
- [ ] 步骤 5：重复本任务测试和 `npm run typecheck`，验证相同输入产生确定预览；FCM 是 `{message:{...payload,token}}`，APNs token 只进入固定服务路径；鉴权头为占位文本，原始秘密不进入 PreviewRequest。以测试固定“结构化高级参数修改与 JSON 编辑不互相覆盖”。
- [ ] 步骤 6：精确暂存本任务文件并本地提交 `功能：实现无损消息编辑与平台请求构造`。

### 任务 4：凭据导入、配置事务与 token 服务

**文件：** 新增 `src/main/credentials/{types,parse-fcm,parse-p8,parse-p12,vault}.ts`、`src/main/credentials/parsers.test.ts`、`src/main/config/{scope,service}.ts`、`src/main/config/service.test.ts`、`src/main/tokens/service.ts`、`src/main/tokens/service.test.ts`、`src/test/credential-fixtures.ts`；修改依赖文件与存储类型。

**接口：** `parseCredential(kind:CredentialKind,bytes:Buffer,password?:string):Result<CredentialSecret>`；`ConfigService.importCredential({kind,password?}):Promise<Result<CredentialSummary|null>>`、`saveSettings(SettingsInput):Promise<Result<PublicConfig>>`、`resolve(scope:Scope,revision:number):Promise<Result<ResolvedConfig>>`；main 私有 `ResolvedConfig` 在 `credentials/types.ts` 定义，包含 `{scope,revision,credentialId,credential,apns?}`。`makeScope(config:PublicConfig,platform:Platform,environment:Environment):Result<Scope>`、`scopeKey(scope:Scope):string`；`TokenService.list/save/delete/select` 与共享 API 参数一致，另有 `markInvalid(scope:Scope,token:string,reason:string):Promise<void>`。

- [ ] 步骤 1：先用运行时生成的虚构证书/密钥写测试，覆盖真实私钥解析、错误密码、无私钥 `.p12`、过期证书、错误曲线 `.p8`、非服务账号 JSON 与取消导入。测试材料不依赖用户文件或外部命令，密钥仅存在临时目录并清理。
- [ ] 步骤 2：写身份测试：改显示名称 scopeKey 不变；同 Project ID 换凭据不变；改项目/包名/Bundle ID/环境后不相等；切回后 token 历史恢复。token 断言去首尾空白、相同 scope 去重、不同 scope 不串用、排序按 lastUsedAt 降序，删除保留已有发送快照。
- [ ] 步骤 3：运行 `npm test -- src/main/credentials/parsers.test.ts src/main/config/service.test.ts src/main/tokens/service.test.ts`，确认失败；添加 `node-forge` 与对应类型，仅在主进程解析 PKCS#12。用 Node crypto 校验 `.p8` 为 EC P-256，FCM 私钥可解析并检查必需字段；`.p12` 按公钥匹配证书与私钥，保留证书链和有效期，不调用外部 openssl。
- [ ] 步骤 4：通过主进程 dialog 选文件，不接受 renderer 指定路径。加密保存待引用凭据后仅返回 CredentialSummary；saveSettings 校验 expectedRevision 和凭据种类，在单个存储事务中切换引用并增加 revision。失败时旧配置保持可用，未保存导入在下次启动时清理；共享引用的凭据不能误删。
- [ ] 步骤 5：实现 token 服务和 scope 函数，select 持久化该 scope 的 token ID 与 lastPlatform；删除已选 token 时清除选择。凭据更新发布版本失效通知。重跑本任务测试与 `npm run typecheck`，补验删除下载原文件后从 StateStore 仍能恢复秘密；导入结果不能含 privateKey、password 或原始路径。
- [ ] 步骤 6：精确暂存本任务文件和依赖锁文件并本地提交 `功能：支持推送凭据配置与 token 隔离`。

### 任务 5：设置页、初始化恢复与受限业务 IPC

**文件：** 新增 `src/main/{bootstrap,ipc}.ts`、`src/main/ipc.test.ts`、`src/renderer/app/{AppShell,AppProvider}.tsx`、`src/renderer/app/client.ts`、`src/renderer/settings/{SettingsPage,FcmSettings,ApnsSettings}.tsx`、`src/renderer/settings/SettingsPage.test.tsx`；修改 Electron/React 入口与样式。

**接口：** `registerIpc({window,configService,tokenService,store}):()=>void` 安装固定通道并返回释放函数；`useApp():{bootstrap,config,reloadConfig,saveSettings}` 使用共享 API 类型。`bootstrap()` 只读取当前状态和公开凭据摘要；中断记录恢复在主进程启动时执行一次，不能在发送期间刷新 bootstrap 时将当前 sending 改成 unknown。默认环境不从磁盘恢复为 production。

- [ ] 步骤 1：先写 React 测试：仅修改名称可保存；两环境独立；`.p8`/`.p12` 切换显示正确字段；取消导入保留原引用；设置未保存离开时提供保存/放弃/继续编辑选择；返回首页草稿不重置。
- [ ] 步骤 2：写 IPC 测试，非法 sender、无效参数、配置 revision 冲突被拒绝；只序列化 AppError，不把底层异常栈和凭据附在错误中；关闭窗口后 listener 已释放。运行 `npm test -- src/main/ipc.test.ts src/renderer/settings/SettingsPage.test.tsx` 确认失败。
- [ ] 步骤 3：使用 createHashRouter + RouterProvider 实现 app:// 下的 `/` 与 `/settings`，通过 data router blocker 处理未保存设置。AppProvider 持有跨路由编辑状态；主进程注册 bootstrap、凭据、配置和 token 接口。saveDraft/listHistory/send 在对应服务接入前明确返回 NOT_READY；不添加通用 IPC 后门。
- [ ] 步骤 4：实现表单校验、导入状态、Project ID/邮箱/有效期摘要和明确保存反馈。私钥不显示在 DOM；错误密码可修正后重新导入；加密不可用显示恢复入口，阻止覆盖已有设置。
- [ ] 步骤 5：运行本任务测试、`npm run typecheck` 和 `npm run build`；启动窗口检查首次进入设置、两种 iOS 凭据字段和返回路由，记录真实截图。调试只用虚构凭据，不连接服务验证导入。
- [ ] 步骤 6：精确暂存本任务文件并本地提交 `界面：实现独立配置页与初始化恢复`。

### 任务 6：FCM 鉴权与不重发的 HTTPS 发送

**文件：** 新增 `src/main/push/{types,errors,https-transport}.ts`、`src/main/push/https-transport.test.ts`、`src/main/push/fcm/{auth,adapter}.ts`、`src/main/push/fcm/{auth,adapter}.test.ts`；修改依赖文件。

**接口：** 消费任务 4 的 ResolvedConfig，main 私有 `SendContext` 包含 `{snapshot:SendSnapshot,resolved:ResolvedConfig,payload:JsonObject}`。`PushAdapter.send(context:SendContext,signal:AbortSignal):Promise<ProviderOutcome>`、`invalidate(credentialId:string):Promise<void>`。`ProviderOutcome` 含终态 status、providerId/httpStatus/providerCode/detail。`ProviderRequest` 为 `{method,url,headers,body:Buffer,tls?}`；`Transport.request(request:ProviderRequest,signal:AbortSignal):Promise<WireResponse>`；`WireResponse` 为 `{status:number,headers:Record<string,string>,body:string}`，失败抛 `DispatchFailure`，证据为 not-started 或 may-have-been-sent。

- [ ] 步骤 1：先写测试：访问令牌缓存按 credentialId 隔离、临近到期刷新；请求只到固定 `https://fcm.googleapis.com/v1/projects/<编码项目 ID>/messages:send`；OAuth scope 固定 `https://www.googleapis.com/auth/firebase.messaging`；导入 JSON 中的 token_uri 不得改变鉴权目的地。
- [ ] 步骤 2：覆盖 FCM 成功 name、401、403、UNREGISTERED、SENDER_ID_MISMATCH、429、503、非 JSON 错误、响应中回显敏感数据和已发出后断线。所有业务错误都断言传输调用次数恰好 1，429/503 也不得自动重发。运行 `npm test -- src/main/push/fcm src/main/push/https-transport.test.ts` 确认失败。
- [ ] 步骤 3：添加 `google-auth-library`。实现 auth 只获取访问令牌，不使用其自动重试的业务 request 方法；总 AbortSignal 传入鉴权流程，截止后不能继续调用推送传输。仅使用受信固定 OAuth 端点，不照搬凭据文件中的 URL。
- [ ] 步骤 4：业务请求使用 Node HTTPS 单次 POST，TLS 证书验证保持开启，禁止自动重定向。传输区分确定未发出与可能已发出；可能发出后任何超时/断线均返回 unknown。非预期响应无法确定接受状态时也返回 unknown，错误映射保留服务码且脱敏。
- [ ] 步骤 5：重跑本任务测试和 `npm run typecheck`；测试 auth 超时后未触发业务请求，凭据更换后不复用旧缓存，日志不含测试私钥/token/正文。此阶段的传输替身测试不声称真实 FCM 已通。
- [ ] 步骤 6：精确暂存本任务文件和锁文件并本地提交 `功能：接入 FCM 鉴权与单次推送发送`。

### 任务 7：APNs 双鉴权与 HTTP/2 发送

**文件：** 新增 `src/main/push/http2-transport.ts`、`src/main/push/http2-transport.test.ts`、`src/main/push/apns/{jwt,adapter,connections}.ts`、`src/main/push/apns/{jwt,adapter}.test.ts`；复用任务 6 类型。

**接口：** `signProviderToken({keyId,teamId,privateKey,nowSeconds}):string`；`ApnsAdapter implements PushAdapter`；`ApnsConnections.get(resolved:ResolvedConfig):Promise<ClientHttp2Session>` / `invalidate(credentialId):Promise<void>` / `close():Promise<void>`。HTTP2Transport 实现相同 Transport 契约，TLS 选项来自已验证凭据。

- [ ] 步骤 1：先写 JWT 测试，使用虚构 P-256 密钥验证签名、ES256、kid、iss、iat 的 UTC 秒；签名编码用 P1363，缓存未过期不重复签名，超过 50 分钟刷新，credentialId 改变后失效。
- [ ] 步骤 2：写 adapter 测试：test→`api.sandbox.push.apple.com`、production→`api.push.apple.com`，路径仅 `/3/device/<合法十六进制 token>`；`.p8` 有 bearer，`.p12` 使用对应 cert/key/chain 且没有 bearer；background 类型 priority 5；拒绝 CRLF header 和非法设备 token。
- [ ] 步骤 3：运行 `npm test -- src/main/push/apns src/main/push/http2-transport.test.ts` 确认失败，再实现 HTTP/2 单次流发送、连接按环境/凭据/应用身份隔离、凭据失效关闭旧连接。TLS 使用系统信任链，不关闭证书校验；node-forge 只解包 PKCS#12，TLS 交给 Node。
- [ ] 步骤 4：映射 200 与 apns-id、BadDeviceToken、DeviceTokenNotForTopic、ExpiredProviderToken、Unregistered、TooManyRequests 等响应；连接中断、GOAWAY、stream reset 不隐式重开业务请求。补测试“流已建立后 reset→unknown，连接建立前失败→not-sent”，断言每次仅创建一次业务流。
- [ ] 步骤 5：重跑本任务测试与 `npm run typecheck`，检查错误和快照无 JWT/私钥；总超时包含连接与签名耗时，失效通知正确清理 JWT 和连接缓存，退出时 close 不触发重发。
- [ ] 步骤 6：精确暂存本任务文件并本地提交 `功能：接入 APNs 密钥证书双鉴权推送`。

### 任务 8：统一发送协调、快照和历史状态

**文件：** 新增 `src/main/send/{coordinator,redaction}.ts`、`src/main/send/{coordinator,redaction}.test.ts`、`src/main/history/service.ts`、`src/main/history/service.test.ts`；修改 `src/main/{ipc,bootstrap,index,lifecycle}.ts`、配置服务。

**接口：** `SendCoordinator.send(input:SendInput):Promise<Result<SendReceipt>>`、`isBusy():boolean`、`onUpdate(listener):()=>void`；`HistoryService.list():Promise<SendReceipt[]>`、`start(snapshot):Promise<void>`、`finish(receipt):Promise<void>`、`recoverInterrupted():Promise<void>`；`redact(text:string,secrets:string[]):string`。ConfigService 在协调器 busy 时拒绝导入、替换与 saveSettings；只读接口不受影响。

- [ ] 步骤 1：先写测试：第二次发送返回 BUSY；configRevision 过期拒绝；消息编辑后快照不变；切换 UI 环境后终态仍属于原 scope；超时使用 fake timer 推进到 30000 ms，返回 unknown 或确定未发出，绝不调用第二次业务发送。
- [ ] 步骤 2：写持久化测试：start 写入失败不调用网络；服务已接受但 finish 失败仍返回 accepted 且 persisted=false；重启把 sending 改成 unknown；101 条实际尝试仅留最新 100 条；同毫秒以稳定序号保证裁剪；校验错误不占记录。
- [ ] 步骤 3：运行 `npm test -- src/main/send src/main/history` 确认失败，实现“取得发送锁→解析配置→校验→冻结快照→持久化 sending→一次发送→持久化终态→释放锁”。持久化 sending 时同步去重保存目标 token 并更新 lastUsedAt；明确无效 token 的响应调用 TokenService.markInvalid，不自动删除。确保每个异常分支 finally 释放锁；credentialId 在不可变 resolved 中固定。
- [ ] 步骤 4：接入 AbortController 的单次 30 秒总期限；请求 ID 贯穿开始/终态事件。持久化失败独立于网络状态；失败详情先按本次秘密和 token 脱敏，再进行通用鉴权头遮蔽。允许界面查看原始业务消息，但日志只留请求 ID、状态和错误码。
- [ ] 步骤 5：接入真实 send/listHistory IPC 与开始/终态事件，onSendUpdate 校验来源并正确取消订阅。重跑本任务测试、IPC 测试与 typecheck，补测网络失败后仍能下一次发送，任意错误分支不泄露秘密。
- [ ] 步骤 6：精确暂存本任务文件并本地提交 `功能：统一发送快照历史与可靠结果状态`。

### 任务 9：A 双栏工作台与草稿完整操作链路

**文件：** 新增 `src/renderer/workbench/{WorkbenchPage,TargetPicker,MessageEditor,JsonEditor,AdvancedFields,RequestPreview,SendResult,HistoryList}.tsx`、`src/renderer/workbench/WorkbenchPage.test.tsx`、`src/renderer/state/{workbench,draft-save-queue}.ts` 及同名 `.test.ts`；修改 AppProvider、首页路由、样式、依赖文件与 saveDraft IPC。

**接口：** `useWorkbench():{state,dispatch,send,loadHistory,flushDrafts}`；reducer 的 action 为 selectPlatform/selectEnvironment/selectToken/editDraft/sendUpdate/loadHistory；`DraftSaveQueue.enqueue(draft:Draft):void` / `flush():Promise<void>`，默认 debounce 500 ms，按 revision 丢弃旧写入。StateStore 层 saveDraft 同样拒绝较小 revision，避免 IPC 顺序反转覆盖。

- [ ] 步骤 1：先写完整交互测试：搜索/粘贴/保存/修改备注/删除 token；生产环境只显示当前 scope 历史；无 token 可编辑但不能发送；格式错误定位编辑器并隐藏旧预览；表单/JSON 往返不丢字段；高级参数默认折叠。
- [ ] 步骤 2：补写状态测试：environment 初始恒为 test；平台切回恢复原草稿；进入设置返回不丢内容；旧保存回调不能清除新草稿的未保存状态；发送中仍可编辑，开始与终态均按 snapshot.id 关联；历史载入只复制原平台内容，不切到 production、不自动发送、不恢复不匹配目标。
- [ ] 步骤 3：运行 `npm test -- src/renderer/workbench/WorkbenchPage.test.tsx src/renderer/state` 确认失败；添加 CodeMirror 的 React 封装与 JSON 语法依赖，实现搜索 combobox、消息表单、JSON 编辑和高级字段，使用任务 3 转换器，不另写第二套平台组装逻辑。
- [ ] 步骤 4：实现顶部状态、左右栏、结果和最近记录；发送按钮禁用语义符合 sending/BUSY，结果文案严格采用服务接受/拒绝/未能发送/状态未知。标题/正文和 payload 使用等宽 JSON 展示；完整 token 可复制，列表默认脱敏；无历史时展示真实空状态。
- [ ] 步骤 5：实现 500 ms 草稿保存、保存失败提示、路由/平台切换刷新和 onBeforeClose 握手；nonce 确认只接受发给本窗口的当前退出请求，退出先等待 DraftSaveQueue.flush，再等待 StateStore.flush。设置页也参与关闭握手处理未保存修改，取消时不退出。补测未到 500 ms 即退出仍保留新内容、伪造确认被拒绝。重复本任务测试、`npm run typecheck`、`npm run build`；实际窗口检查 1180×820 与 900×680、长 token、长中文、JSON 横向滚动、键盘操作和错误定位，截图对照已选 A 布局。
- [ ] 步骤 6：精确暂存本任务文件和锁文件并本地提交 `界面：完成双栏推送工作台与草稿恢复`。

### 任务 10：桌面端集成、安装包与中文交付说明

**文件：** 新增 `playwright.config.ts`、`e2e/{app,storage-restart}.spec.ts`、`electron-builder.yml`、`README.md`、`docs/verification.md`；修改 package scripts、锁文件、主进程退出集成与必要的打包资源配置。截图和测试结果放入忽略目录 `test-results/`，更新 `.gitignore` 排除它与 `playwright-report/`。

**接口：** 新增 `npm run test:e2e`、`npm run pack`、`npm run dist:win`、`npm run dist:mac:x64`、`npm run dist:mac:arm64`。pack 先构建再执行 electron-builder `--dir`；Windows 为 NSIS x64，macOS 为对应架构 DMG；所有构建默认不发布远端。

- [ ] 步骤 1：先写 Electron 集成用例：真实启动打包前应用，首次没有凭据；通过 Playwright 主进程测试能力替换原生文件选择结果导入本地虚构凭据，不给产品暴露测试 HTTP/IPC 后门。保存 token/非法 JSON 草稿→正常关闭→重启，断言原文和 token 保留、环境回到 test、设置页可用。
- [ ] 步骤 2：使用独立临时 userData 启动两个测试实例，保护用户日常数据。先运行 `npm run test:e2e` 确认与集成缺口对应的失败，再完善生命周期和最终装配；不得为了通过测试关闭沙箱、TLS 校验或改为明文存储。
- [ ] 步骤 3：在实际 Electron 上检查 safeStorage 可用且加密文件不存在测试 token/私钥明文；测试加密不可用时保留原文件并可重试。补验启动恢复中断发送为 unknown，以及非法 JSON 重启恢复。集成测试不连接真实推送服务。
- [ ] 步骤 4：配置 electron-builder 的 appId、文件白名单、asar 和双系统目标，排除 `.superpowers`、用户数据、测试私钥与开发源码映射。检查产品代码不再包含阶段性的 NOT_READY 占位分支。执行 `npm run typecheck`、`npm test`、`npm run build`、`npm run test:e2e`、`npm run pack`，均应退出 0；随后在 Windows 执行 `npm run dist:win` 并实际启动产物检查资源路径与 preload。
- [ ] 步骤 5：在 README 写入安装/开发/打包、FCM 服务账号 JSON 获取入口、APNs 两种鉴权字段、JSON 边界、数据位置与错误说明。`docs/verification.md` 逐项记录命令/环境/结果；未获得真实凭据、设备或 macOS 时如实标记待验证。真实联调需用户提供实际配置，发送只到用户指定测试设备；macOS 签名/公证按获得的凭据配置，不能声称已签名。
- [ ] 步骤 6：按设计验收表核对覆盖范围并检查最终 diff。精确暂存本任务文件、本地提交 `交付：完善桌面集成打包与使用说明`；记录 Windows 产物路径和 macOS 构建命令、待验收项，不推送或发布。

## 计划自审与交接

- 设计第 1～3 节由任务 1、5、9、10 覆盖；第 4 节由任务 4、9 覆盖；第 5 节由任务 3、9 覆盖。
- 设计第 6～7 节由任务 1、2、4、5、8 覆盖；第 8 节由任务 6、7、8、9 覆盖；第 9 节由各任务针对性检查及任务 10 覆盖。
- 五项审查重点都有明确归属测试；provider 请求和共享预览使用不同类型，私钥不跨 IPC；配置 revision、草稿 revision 和请求 ID 各自承担独立职责。
- 当前阶段只创建实施计划，不执行复选框中的安装、产品代码或测试。书面计划经用户审阅并选择执行方式后，才开始任务 1。
- 推荐当前会话直接执行：任务之间共享契约较多，按顺序完成更利于保持一致。用户也可选择子代理逐任务执行和独立审查；未选择前不派发代理。

## 实施时参考的官方文档

- [electron-vite 起步与版本要求](https://electron-vite.org/guide/)
- [Electron 进程安全建议](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Google Auth Library Node.js](https://docs.cloud.google.com/nodejs/docs/reference/google-auth-library/latest)
- [Node.js TLS](https://nodejs.org/api/tls.html) 与 [HTTP/2](https://nodejs.org/api/http2.html)
- [node-forge PKCS#12](https://github.com/digitalbazaar/forge#pkcs12)
- [FCM 消息有效期范围](https://firebase.google.com/docs/cloud-messaging/customize-messages/setting-message-lifespan)
- [electron-builder 多平台构建](https://www.electron.build/docs/features/multi-platform-build/)
- APNs 和 FCM 消息协议依据沿用设计说明第 11 节的官方文档；具体依赖 API 以任务 1/对应任务锁定版本为准。
