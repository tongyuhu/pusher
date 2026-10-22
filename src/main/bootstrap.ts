import type { BootstrapSnapshot } from '../shared/contracts'
import type { StateStore } from './storage/state-store'
export async function bootstrap(store:StateStore):Promise<BootstrapSnapshot>{const s=await store.read();const ids=new Set([...Object.values(s.config.android),...Object.values(s.config.ios)].flatMap(c=>c.credentialId?[c.credentialId]:[]));return {config:s.config,credentialSummaries:Object.values(s.credentials).filter(c=>ids.has(c.summary.id)).map(c=>c.summary),drafts:s.drafts,history:s.history,lastPlatform:s.lastPlatform,selections:s.selections}}
