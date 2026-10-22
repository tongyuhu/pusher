import type { Platform, Environment, SendReceipt } from '../../shared/contracts'
export interface WorkbenchState {
  platform: Platform
  environment: Environment
  token: string
  tokenScopeKey?: string
  sending: boolean
  activeId?: string
  result?: SendReceipt
  history: SendReceipt[]
}
export type WorkbenchAction =
  | { type: 'restore'; platform: Platform; history: SendReceipt[] }
  | { type: 'selectPlatform'; platform: Platform }
  | { type: 'selectEnvironment'; environment: Environment }
  | { type: 'selectToken'; token: string; scopeKey?: string }
  | { type: 'beginSend' }
  | { type: 'cancelSend' }
  | { type: 'sendUpdate'; receipt: SendReceipt }
  | { type: 'loadHistory'; receipt: SendReceipt; scopeMatches: boolean; scopeKey?: string }
export function createWorkbenchState(platform: Platform): WorkbenchState {
  return { platform, environment: 'test', token: '', sending: false, history: [] }
}
export function workbenchReducer(s: WorkbenchState, a: WorkbenchAction): WorkbenchState {
  switch (a.type) {
    case 'restore':
      return { ...createWorkbenchState(a.platform), history: a.history }
    case 'selectPlatform':
      return { ...s, platform: a.platform, token: '', tokenScopeKey: undefined }
    case 'selectEnvironment':
      return { ...s, environment: a.environment, token: '', tokenScopeKey: undefined }
    case 'selectToken':
      return { ...s, token: a.token, tokenScopeKey: a.scopeKey }
    case 'beginSend':
      return { ...s, sending: true, activeId: undefined }
    case 'cancelSend':
      return { ...s, sending: false }
    case 'loadHistory':
      return {
        ...s,
        platform: a.receipt.snapshot.scope.platform,
        token: a.scopeMatches ? a.receipt.snapshot.token : '',
        tokenScopeKey: a.scopeMatches ? a.scopeKey : undefined,
      }
    case 'sendUpdate': {
      const receipt = a.receipt,
        history = [receipt, ...s.history.filter((h) => h.snapshot.id !== receipt.snapshot.id)]
          .sort((a, b) => (b.snapshot.startedAt || '').localeCompare(a.snapshot.startedAt || ''))
          .slice(0, 100)
      if (receipt.status !== 'sending' && s.activeId && s.activeId !== receipt.snapshot.id)
        return { ...s, history }
      return {
        ...s,
        history,
        result: receipt,
        activeId: receipt.snapshot.id,
        sending: receipt.status === 'sending',
      }
    }
  }
}
