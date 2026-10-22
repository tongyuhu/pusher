import type { ConnectionOptions } from 'node:tls'
import type { JsonObject,SendSnapshot,SendStatus } from '../../shared/contracts'
import type { ResolvedConfig } from '../credentials/types'
export interface SendContext {snapshot:SendSnapshot;resolved:ResolvedConfig;payload:JsonObject}
export interface ProviderOutcome {status:Exclude<SendStatus,'sending'>;providerId?:string;httpStatus?:number;providerCode?:string;detail?:string}
export interface PushAdapter {send(context:SendContext,signal:AbortSignal):Promise<ProviderOutcome>;invalidate(credentialId:string):Promise<void>}
export interface ProviderRequest {method:string;url:string;headers:Record<string,string>;body:Buffer;tls?:Pick<ConnectionOptions,'cert'|'key'|'ca'|'pfx'|'passphrase'>}
export interface WireResponse {status:number;headers:Record<string,string>;body:string}
export interface Transport {request(request:ProviderRequest,signal:AbortSignal):Promise<WireResponse>}
