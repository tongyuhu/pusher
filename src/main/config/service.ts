import { randomUUID } from 'node:crypto'
import path from 'node:path'
import type {
  CredentialKind,
  CredentialSummary,
  PublicConfig,
  SettingsInput,
  Scope,
  Result,
} from '../../shared/contracts'
import { settingsSchema } from '../../shared/schemas'
import { StateStore } from '../storage/state-store'
import { AppFault, guarded } from '../errors'
import { parseCredential } from '../credentials/vault'
import type { ResolvedConfig } from '../credentials/types'
import { makeScope, scopeKey } from './scope'
export class ConfigService {
  isBusy = () => false
  onInvalidate: (id: string) => Promise<void> = async () => {}
  constructor(
    private store: StateStore,
    private chooseFile: (kind: CredentialKind) => Promise<{ fileName: string; bytes: Buffer } | null>,
  ) {}
  private assertIdle() {
    if (this.isBusy()) throw new AppFault('BUSY', '发送过程中暂时不能修改凭据和配置')
  }
  async importCredential(input: {
    kind: CredentialKind
    password?: string
  }): Promise<Result<CredentialSummary | null>> {
    return guarded(async () => {
      this.assertIdle()
      const selected = await this.chooseFile(input.kind)
      if (!selected) return null
      const parsed = parseCredential(input.kind, selected.bytes, input.password)
      if (!parsed.ok) throw new AppFault(parsed.error.code, parsed.error.message)
      const secret = parsed.value,
        summary: CredentialSummary = {
          id: randomUUID(),
          kind: input.kind,
          fileName: path.basename(selected.fileName),
          importedAt: new Date().toISOString(),
          ...(secret.kind === 'fcm'
            ? { projectId: secret.projectId, clientEmail: secret.clientEmail }
            : secret.kind === 'apns-p12'
              ? { expiresAt: secret.expiresAt }
              : {}),
        }
      await this.store.update((s) => {
        this.assertIdle()
        s.credentials[summary.id] = { summary, secret }
        return s
      })
      return summary
    })
  }
  async saveSettings(input: SettingsInput): Promise<Result<PublicConfig>> {
    return guarded(async () => {
      const parsed = settingsSchema.safeParse(input)
      if (!parsed.success) throw new AppFault('INVALID_SETTINGS', '请填写有效的应用配置')
      const previous = (await this.store.read()).config
      let saved!: PublicConfig
      await this.store.update((s) => {
        this.assertIdle()
        if (s.config.revision !== input.expectedRevision)
          throw new AppFault('CONFIG_CHANGED', '配置已更新，请刷新设置后重试')
        for (const env of ['test', 'production'] as const) {
          const a = input.android[env],
            i = input.ios[env]
          if (
            a.credentialId &&
            (!a.packageName.trim() || s.credentials[a.credentialId]?.secret.kind !== 'fcm')
          )
            throw new AppFault(
              'INVALID_ANDROID_CONFIG',
              'Android 需要包名和有效的服务账号凭据',
              `android.${env}`,
            )
          if (i.credentialId) {
            if (
              !/^[A-Za-z0-9.-]+$/.test(i.bundleId) ||
              s.credentials[i.credentialId]?.secret.kind !== `apns-${i.authKind}`
            )
              throw new AppFault('INVALID_IOS_CONFIG', 'iOS Bundle ID 或凭据类型不正确', `ios.${env}`)
            if (
              i.authKind === 'p8' &&
              (!/^[A-Za-z0-9]{10}$/.test(i.keyId || '') || !/^[A-Za-z0-9]{10}$/.test(i.teamId || ''))
            )
              throw new AppFault('INVALID_APNS_IDS', 'Key ID 与 Team ID 应为 10 位字母或数字', `ios.${env}`)
          }
        }
        const { expectedRevision, ...settings } = parsed.data
        saved = { ...settings, revision: expectedRevision + 1 }
        s.config = saved
        return s
      })
      const ids = new Set(
        [...Object.values(previous.android), ...Object.values(previous.ios)].flatMap((c) =>
          c.credentialId ? [c.credentialId] : [],
        ),
      )
      await Promise.all([...ids].map((id) => this.onInvalidate(id).catch(() => {})))
      return saved
    })
  }
  async resolve(scope: Scope, revision: number): Promise<Result<ResolvedConfig>> {
    return guarded(async () => {
      const s = await this.store.read()
      if (s.config.revision !== revision) throw new AppFault('CONFIG_CHANGED', '配置已更新，请核对目标后重试')
      const actual = makeScope(
        s.config,
        scope.platform,
        scope.environment,
        Object.values(s.credentials).map((c) => c.summary),
      )
      if (!actual.ok || scopeKey(actual.value) !== scopeKey(scope))
        throw new AppFault('SCOPE_MISMATCH', '目标与当前应用配置不一致')
      const c =
        scope.platform === 'ios' ? s.config.ios[scope.environment] : s.config.android[scope.environment]
      const entry = c.credentialId ? s.credentials[c.credentialId] : undefined
      if (!entry) throw new AppFault('NOT_CONFIGURED', '当前环境尚未配置推送凭据')
      return {
        scope,
        revision,
        credentialId: entry.summary.id,
        credential: entry.secret,
        ...(scope.platform === 'ios'
          ? {
              apns: {
                keyId: s.config.ios[scope.environment].keyId,
                teamId: s.config.ios[scope.environment].teamId,
              },
            }
          : {}),
      }
    })
  }
  async cleanupUnreferenced(): Promise<void> {
    await this.store.update((s) => {
      const ids = new Set(
        [...Object.values(s.config.android), ...Object.values(s.config.ios)].flatMap((c) =>
          c.credentialId ? [c.credentialId] : [],
        ),
      )
      for (const id of Object.keys(s.credentials)) if (!ids.has(id)) delete s.credentials[id]
      return s
    })
  }
}
