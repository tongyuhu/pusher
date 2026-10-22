import type { BootstrapSnapshot, CredentialSummary, PublicConfig, TokenRecord } from '../../shared/contracts'
export type CredentialSecret =
  | { kind: 'fcm'; projectId: string; clientEmail: string; privateKey: string }
  | { kind: 'apns-p8'; privateKey: string }
  | { kind: 'apns-p12'; originalBase64: string; password: string; expiresAt: string }
export interface CredentialEntry {
  summary: CredentialSummary
  secret: CredentialSecret
}
export interface AppState extends Omit<BootstrapSnapshot, 'credentialSummaries'> {
  schemaVersion: 1
  credentials: Record<string, CredentialEntry>
  tokens: TokenRecord[]
}
export function emptyConfig(): PublicConfig {
  return {
    revision: 0,
    displayName: '我的 App',
    android: { test: { packageName: '' }, production: { packageName: '' } },
    ios: { test: { bundleId: '', authKind: 'p8' }, production: { bundleId: '', authKind: 'p8' } },
  }
}
export function emptyState(): AppState {
  return {
    schemaVersion: 1,
    config: emptyConfig(),
    credentials: {},
    tokens: [],
    drafts: {},
    history: [],
    lastPlatform: 'android',
    selections: {},
  }
}
