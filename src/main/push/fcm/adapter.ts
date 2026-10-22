import type { Transport,PushAdapter,SendContext,ProviderOutcome } from '../types'
import { DispatchFailure } from '../errors'
import { FcmAuth } from './auth'
import { HttpsTransport } from '../https-transport'
export class FcmAdapter implements PushAdapter {
  constructor(private transport:Transport=new HttpsTransport(),private auth:Pick<FcmAuth,'get'|'invalidate'>=new FcmAuth()){}
  async send(ctx:SendContext,signal:AbortSignal):Promise<ProviderOutcome>{
    let token:string
    try{token=await this.auth.get(ctx.resolved,signal);if(signal.aborted)throw Error('ABORTED')}catch{return {status:'not-sent',providerCode:'AUTH_FAILED',detail:'鉴权未完成，请检查服务账号权限、密钥和网络；本次未发出业务推送。'}}
    if(ctx.snapshot.scope.platform!=='android')return {status:'not-sent',providerCode:'PLATFORM_MISMATCH'}
    try{
      const response=await this.transport.request({method:'POST',url:`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(ctx.snapshot.scope.projectId)}/messages:send`,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:Buffer.from(JSON.stringify({message:{...ctx.payload,token:ctx.snapshot.token}}))},signal)
      let body:any;try{body=JSON.parse(response.body)}catch{}
      if(response.status===200&&typeof body?.name==='string')return {status:'accepted',providerId:body.name.replaceAll(token,'[已隐藏]'),httpStatus:200,detail:'FCM 已接受请求，设备接收情况需在 App 中确认。'}
      if(response.status>=400){const code=body?.error?.details?.find((d:any)=>typeof d.errorCode==='string')?.errorCode||body?.error?.status||`HTTP_${response.status}`;return {status:'rejected',httpStatus:response.status,providerCode:String(code).replaceAll(token,'[已隐藏]'),detail:JSON.stringify(body?.error||{message:'推送服务拒绝请求'}).replaceAll(token,'[已隐藏]')}}
      return {status:'unknown',httpStatus:response.status,detail:'响应不符合预期，无法确认推送是否被接受，请核对后决定是否重试。'}
    }catch(e){return {status:e instanceof DispatchFailure&&e.evidence==='not-started'?'not-sent':'unknown',providerCode:e instanceof DispatchFailure?e.code:'NETWORK_ERROR',detail:'网络请求未完成；状态未知时不要直接重复发送，请先核对设备。'}}
  }
  async invalidate(id:string):Promise<void>{await this.auth.invalidate(id)}
}
