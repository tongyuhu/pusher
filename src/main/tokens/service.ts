import { randomUUID } from 'node:crypto'
import type { Scope,TokenRecord,Result } from '../../shared/contracts'
import { StateStore } from '../storage/state-store'
import { scopeKey } from '../config/scope'
import { AppFault,guarded } from '../errors'
export class TokenService {
  constructor(private store:StateStore,private now=()=>new Date().toISOString()){}
  async list(scope:Scope):Promise<Result<TokenRecord[]>>{return guarded(async()=>(await this.store.read()).tokens.filter(t=>scopeKey(t.scope)===scopeKey(scope)).sort((a,b)=>b.lastUsedAt.localeCompare(a.lastUsedAt)))}
  async save(input:{scope:Scope;token:string;note:string}):Promise<Result<TokenRecord>>{return guarded(async()=>{
    const token=input.token.trim();if(!token||token.length>8192)throw new AppFault('INVALID_TOKEN','请填写有效的设备 token','token')
    let saved!:TokenRecord;await this.store.update(s=>{const existing=s.tokens.find(t=>scopeKey(t.scope)===scopeKey(input.scope)&&t.token===token),now=this.now();saved=existing?{...existing,note:input.note,lastUsedAt:now}:{id:randomUUID(),scope:input.scope,token,note:input.note,createdAt:now,lastUsedAt:now};s.tokens=s.tokens.filter(t=>t.id!==saved.id);s.tokens.push(saved);return s});return saved
  })}
  async delete(input:{scope:Scope;id:string}):Promise<Result<void>>{return guarded(async()=>{await this.store.update(s=>{s.tokens=s.tokens.filter(t=>!(t.id===input.id&&scopeKey(t.scope)===scopeKey(input.scope)));if(s.selections[scopeKey(input.scope)]===input.id)delete s.selections[scopeKey(input.scope)];return s})})}
  async select(input:{scope:Scope;id?:string}):Promise<Result<void>>{return guarded(async()=>{await this.store.update(s=>{const key=scopeKey(input.scope);if(input.id&&!s.tokens.some(t=>t.id===input.id&&scopeKey(t.scope)===key))throw new AppFault('TOKEN_NOT_FOUND','该设备记录不存在');if(input.id)s.selections[key]=input.id;else delete s.selections[key];s.lastPlatform=input.scope.platform;return s})})}
  async markInvalid(scope:Scope,token:string,reason:string):Promise<void>{await this.store.update(s=>{for(const t of s.tokens)if(t.token===token&&scopeKey(t.scope)===scopeKey(scope))t.invalidReason=reason;return s})}
}
