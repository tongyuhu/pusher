import type { PublicConfig, Platform, Environment, CredentialSummary, Scope, Result } from './contracts'
import { ok, fail } from './result'
export function makeScope(
  config: PublicConfig,
  platform: Platform,
  environment: Environment,
  summaries: CredentialSummary[] = [],
): Result<Scope> {
  if (platform === 'ios') {
    const i = config.ios[environment]
    return i.bundleId
      ? ok({ platform, environment, bundleId: i.bundleId })
      : fail('NOT_CONFIGURED', '请先配置 iOS Bundle ID')
  }
  const a = config.android[environment],
    c = summaries.find((s) => s.id === a.credentialId)
  return a.packageName && c?.projectId
    ? ok({ platform, environment, packageName: a.packageName, projectId: c.projectId })
    : fail('NOT_CONFIGURED', '请先配置 Android 包名与 Firebase 凭据')
}
export function scopeKey(scope: Scope): string {
  return JSON.stringify(
    scope.platform === 'ios'
      ? [scope.platform, scope.environment, scope.bundleId]
      : [scope.platform, scope.environment, scope.packageName, scope.projectId],
  )
}
