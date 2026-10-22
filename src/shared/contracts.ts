export type Platform = 'android' | 'ios'
export type Environment = 'test' | 'production'
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
export type JsonObject = { [key: string]: JsonValue }
export interface AppError { code: string; message: string; field?: string; retryable: boolean }
export type Result<T> = { ok: true; value: T } | { ok: false; error: AppError }
export type CredentialKind = 'fcm' | 'apns-p8' | 'apns-p12'
export interface CredentialSummary { id: string; kind: CredentialKind; fileName: string; importedAt: string; projectId?: string; clientEmail?: string; expiresAt?: string }
export interface AndroidConfig { packageName: string; credentialId?: string }
export interface IosConfig { bundleId: string; authKind: 'p8' | 'p12'; keyId?: string; teamId?: string; credentialId?: string }
export interface PublicConfig { revision: number; displayName: string; android: Record<Environment, AndroidConfig>; ios: Record<Environment, IosConfig> }
export type SettingsInput = Omit<PublicConfig, 'revision'> & { expectedRevision: number }
export type Scope = { platform: 'android'; environment: Environment; packageName: string; projectId: string } | { platform: 'ios'; environment: Environment; bundleId: string }
export interface TokenRecord { id: string; scope: Scope; token: string; note: string; createdAt: string; lastUsedAt: string; invalidReason?: string }
export interface Draft { platform: Platform; revision: number; mode: 'form' | 'json'; messageType: 'notification' | 'data' | 'mixed'; rawText: string; lastValidPayload: JsonObject; advanced: JsonObject; formStash: JsonObject }
export interface PreviewRequest { method: string; url: string; headers: Record<string, string>; body: JsonObject; estimatedBytes: number }
export interface SendInput { scope: Scope; configRevision: number; token: string; draft: Draft }
export type SendStatus = 'sending' | 'accepted' | 'rejected' | 'not-sent' | 'unknown'
export interface SendSnapshot { id: string; scope: Scope; configRevision: number; token: string; request: PreviewRequest; startedAt: string }
export interface SendReceipt { snapshot: SendSnapshot; status: SendStatus; elapsedMs: number; providerId?: string; httpStatus?: number; providerCode?: string; detail?: string; persisted: boolean }
export interface BootstrapSnapshot { config: PublicConfig; credentialSummaries: CredentialSummary[]; drafts: Partial<Record<Platform, Draft>>; history: SendReceipt[]; lastPlatform: Platform; selections: Record<string, string> }
export interface PusherApi {
  bootstrap(): Promise<Result<BootstrapSnapshot>>
  importCredential(input: { kind: CredentialKind; password?: string }): Promise<Result<CredentialSummary | null>>
  saveSettings(input: SettingsInput): Promise<Result<PublicConfig>>
  listTokens(scope: Scope): Promise<Result<TokenRecord[]>>
  saveToken(input: { scope: Scope; token: string; note: string }): Promise<Result<TokenRecord>>
  deleteToken(input: { scope: Scope; id: string }): Promise<Result<void>>
  selectToken(input: { scope: Scope; id?: string }): Promise<Result<void>>
  saveDraft(draft: Draft): Promise<Result<void>>
  listHistory(): Promise<Result<SendReceipt[]>>
  send(input: SendInput): Promise<Result<SendReceipt>>
  onSendUpdate(listener: (receipt: SendReceipt) => void): () => void
  onBeforeClose(listener: () => Promise<void>): () => void
}
