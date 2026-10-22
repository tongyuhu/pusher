import { randomUUID } from 'node:crypto'
import type { SendInput,SendReceipt,SendSnapshot,Result,Platform } from '../../shared/contracts'
import { sendInputSchema } from '../../shared/schemas'
import { ok,fail } from '../../shared/result'
import { buildPreview } from '../../shared/message/preview'
import { validatePayload } from '../../shared/message/json'
import type { StateStore } from '../storage/state-store'
import type { ConfigService } from '../config/service'
import type { TokenService } from '../tokens/service'
import type { HistoryService } from '../history/service'
import type { PushAdapter,ProviderOutcome } from '../push/types'
import { redact } from './redaction'
interface Services {store:StateStore;configService:ConfigService;history:HistoryService;tokenService:TokenService;adapters:Record<Platform,PushAdapter>}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child)}return value}
export class SendCoordinator {
  private busy=false
  private listeners=new Set<(receipt:SendReceipt)=>void>()
  constructor(private services:Services){services.configService.isBusy=()=>this.busy}
  isBusy():boolean{return this.busy}
  onUpdate(listener:(receipt:SendReceipt)=>void):()=>void{this.listeners.add(listener);return ()=>this.listeners.delete(listener)}
  private emit(receipt:SendReceipt){for(const listener of this.listeners){try{listener(structuredClone(receipt))}catch{}}}
  async send(raw:SendInput):Promise<Result<SendReceipt>>{
    if(this.busy)return fail('BUSY','正在发送，请等待本次请求结束')
    this.busy=true;let timer:ReturnType<typeof setTimeout>|undefined
    try{
      const parsed=sendInputSchema.safeParse(raw);if(!parsed.success)return fail('INVALID_ARGUMENT','发送参数无效，请检查目标和消息内容')
      const input=structuredClone(parsed.data) as SendInput,resolved=await this.services.configService.resolve(input.scope,input.configRevision)
      if(!resolved.ok)return resolved
      if(resolved.value.credential.kind==='apns-p12'&&Date.parse(resolved.value.credential.expiresAt)<=Date.now())return fail('CERTIFICATE_EXPIRED','推送证书已过期，请在设置中替换')
      const preview=buildPreview((await this.services.store.read()).config,input),payload=validatePayload(input.draft)
      if(!preview.ok)return preview;if(!payload.ok)return payload
      const snapshot:SendSnapshot=freeze({id:randomUUID(),scope:input.scope,configRevision:input.configRevision,token:input.token,request:preview.value,startedAt:new Date().toISOString()})
      await this.services.history.start(snapshot)
      this.emit({snapshot,status:'sending',elapsedMs:0,persisted:true})
      const controller=new AbortController(),start=Date.now()
      const timeout=new Promise<ProviderOutcome>(resolve=>{timer=setTimeout(()=>{controller.abort();resolve({status:'unknown',providerCode:'TIMEOUT',detail:'请求超过 30 秒，无法确认发送状态，请核对设备后决定是否重试。'})},30000)})
      const sending=this.services.adapters[input.scope.platform].send({snapshot,resolved:resolved.value,payload:payload.value},controller.signal).catch(():ProviderOutcome=>({status:'unknown',providerCode:'UNEXPECTED_ERROR',detail:'发送未正常结束，无法确认请求状态。'}))
      const outcome=await Promise.race([sending,timeout]);if(timer)clearTimeout(timer)
      const secret=resolved.value.credential,secrets=[snapshot.token,secret.privateKey,...(secret.kind==='apns-p12'?[secret.password,secret.originalBase64]:[])]
      const receipt:SendReceipt={snapshot,...outcome,elapsedMs:Date.now()-start,persisted:true,detail:outcome.detail?redact(outcome.detail,secrets).slice(0,8192):undefined,providerCode:outcome.providerCode?redact(outcome.providerCode,secrets).slice(0,120):undefined,providerId:outcome.providerId?redact(outcome.providerId,secrets):undefined}
      try{await this.services.history.finish(receipt)}catch{receipt.persisted=false}
      if(['UNREGISTERED','Unregistered','BadDeviceToken'].includes(receipt.providerCode||''))await this.services.tokenService.markInvalid(input.scope,input.token,receipt.providerCode!).catch(()=>{})
      this.emit(receipt);return ok(receipt)
    }catch{return fail('SEND_SETUP_FAILED','发送未能开始：请检查本地保存状态、凭据和消息格式，原编辑内容已保留。',undefined,true)}
    finally{if(timer)clearTimeout(timer);this.busy=false}
  }
}
