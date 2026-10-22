import type { Transport,PushAdapter,SendContext,ProviderOutcome } from '../types'
import { DispatchFailure } from '../errors'
import { Http2Transport } from '../http2-transport'
import { ApnsConnections } from './connections'
import { signProviderToken } from './jwt'
export class ApnsAdapter implements PushAdapter {
  private cache=new Map<string,{token:string;at:number}>()
  constructor(private transport?:Transport,private connections=new ApnsConnections(),private now=()=>Date.now()){}
  async send(ctx:SendContext,signal:AbortSignal):Promise<ProviderOutcome>{
    const scope=ctx.snapshot.scope,c=ctx.resolved.credential
    if(scope.platform!=='ios'||signal.aborted||!ctx.snapshot.token||!/^[a-fA-F0-9]+$/.test(ctx.snapshot.token))return {status:'not-sent',providerCode:'INVALID_TARGET',detail:'APNs 目标 token 或平台不正确。'}
    if(Object.values(ctx.snapshot.request.headers).some(v=>/[\r\n]/.test(v)))return {status:'not-sent',providerCode:'INVALID_HEADER'}
    const headers={...ctx.snapshot.request.headers};delete headers.Authorization;delete headers.authorization;headers['apns-topic']=scope.bundleId
    let token=''
    try{
      if(c.kind==='apns-p8'){
        const ids=ctx.resolved.apns;if(!ids?.keyId||!ids.teamId)throw Error('INVALID_KEY_IDS')
        const cached=this.cache.get(ctx.resolved.credentialId),now=this.now()
        token=cached&&now-cached.at<3000000&&now>=cached.at?cached.token:signProviderToken({keyId:ids.keyId,teamId:ids.teamId,privateKey:c.privateKey,nowSeconds:Math.floor(now/1000)})
        if(token!==cached?.token)this.cache.set(ctx.resolved.credentialId,{token,at:now})
        headers.authorization=`bearer ${token}`
      }else if(c.kind!=='apns-p12')throw Error('INVALID_CREDENTIAL')
    }catch{return {status:'not-sent',providerCode:'AUTH_FAILED',detail:'APNs 签名失败，请检查密钥、Key ID 与 Team ID。'}}
    try{
      const response=await (this.transport||new Http2Transport(this.connections,ctx.resolved)).request({url:`https://${scope.environment==='test'?'api.sandbox.push.apple.com':'api.push.apple.com'}/3/device/${ctx.snapshot.token}`,method:'POST',headers,body:Buffer.from(JSON.stringify(ctx.payload)),...(c.kind==='apns-p12'?{tls:{pfx:Buffer.from(c.originalBase64,'base64'),passphrase:c.password}}:{})},signal)
      const hide=(s:string)=>token?s.replaceAll(token,'[已隐藏]'):s
      if(response.status===200)return {status:'accepted',httpStatus:200,providerId:hide(response.headers['apns-id']||''),detail:'APNs 已接受请求，设备接收情况需在 App 中确认。'}
      let body:any;try{body=JSON.parse(response.body)}catch{}
      return response.status>=400?{status:'rejected',httpStatus:response.status,providerCode:hide(String(body?.reason||`HTTP_${response.status}`)),detail:hide(JSON.stringify(body||{message:'APNs 拒绝请求'}))}:{status:'unknown',httpStatus:response.status,detail:'响应无法确认发送状态，请核对设备后决定是否重试。'}
    }catch(e){return {status:e instanceof DispatchFailure&&e.evidence==='not-started'?'not-sent':'unknown',providerCode:e instanceof DispatchFailure?e.code:'NETWORK_ERROR',detail:'APNs 连接未完成，状态未知时请先核对设备，工具不会自动重发。'}}
  }
  async invalidate(id:string):Promise<void>{this.cache.delete(id);await this.connections.invalidate(id)}
  async close():Promise<void>{await this.connections.close()}
}
