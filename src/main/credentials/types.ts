import type { Scope } from '../../shared/contracts'
import type { CredentialSecret } from '../storage/types'
export type { CredentialSecret } from '../storage/types'
export interface ResolvedConfig { scope:Scope;revision:number;credentialId:string;credential:CredentialSecret;apns?:{keyId?:string;teamId?:string} }
