import { constants } from 'node:http2'
import type { ResolvedConfig } from '../credentials/types'
import type { ProviderRequest,Transport,WireResponse } from './types'
import { ApnsConnections } from './apns/connections'
import { abortable,DispatchFailure } from './errors'
export class Http2Transport implements Transport {
  constructor(private connections:ApnsConnections,private config:ResolvedConfig){}
  async request(input:ProviderRequest,signal:AbortSignal):Promise<WireResponse>{
    if(signal.aborted)throw new DispatchFailure('not-started','ABORTED')
    let session
    try{session=await abortable(this.connections.get(this.config),signal)}catch{if(signal.aborted)await this.connections.invalidate(this.config.credentialId);throw new DispatchFailure('not-started','CONNECT_FAILED')}
    if(signal.aborted)throw new DispatchFailure('not-started','ABORTED')
    return new Promise((resolve,reject)=>{
      let sent=false,finished=false,status=0,length=0;const chunks:Buffer[]=[],headers:Record<string,string>={}
      const stream=session.request({':method':input.method,':path':new URL(input.url).pathname,...Object.fromEntries(Object.entries(input.headers).map(([k,v])=>[k.toLowerCase(),v]))})
      const clean=()=>signal.removeEventListener('abort',abort)
      const fail=(code:string)=>{if(finished)return;finished=true;clean();reject(new DispatchFailure(sent?'may-have-been-sent':'not-started',code))}
      const abort=()=>{fail('ABORTED');stream.close(constants.NGHTTP2_CANCEL)}
      signal.addEventListener('abort',abort,{once:true})
      stream.on('response',h=>{status=Number(h[':status']||0);for(const [k,v]of Object.entries(h))if(!k.startsWith(':'))headers[k]=String(v)})
      stream.on('data',(b:Buffer)=>{length+=b.length;if(length>65536){fail('RESPONSE_TOO_LARGE');stream.close(constants.NGHTTP2_CANCEL)}else chunks.push(b)})
      stream.on('error',()=>fail('STREAM_ERROR'));stream.on('close',()=>{if(!finished)fail('STREAM_RESET')})
      stream.on('end',()=>{if(finished)return;if(stream.rstCode){fail('STREAM_RESET');return}finished=true;clean();resolve({status,headers,body:Buffer.concat(chunks).toString('utf8')})})
      sent=true;stream.end(input.body)
    })
  }
}
