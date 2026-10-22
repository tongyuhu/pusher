import { connect,type ClientHttp2Session } from 'node:http2'
import type { ResolvedConfig } from '../../credentials/types'
export class ApnsConnections {
  private cache=new Map<string,{credentialId:string;session:ClientHttp2Session;ready:Promise<ClientHttp2Session>}>()
  async get(config:ResolvedConfig):Promise<ClientHttp2Session>{
    if(config.scope.platform!=='ios')throw Error('PLATFORM_MISMATCH')
    const key=JSON.stringify([config.credentialId,config.scope.environment,config.scope.bundleId]),existing=this.cache.get(key)
    if(existing&&!existing.session.destroyed&&!existing.session.closed)return existing.ready
    const c=config.credential,host=config.scope.environment==='test'?'api.sandbox.push.apple.com':'api.push.apple.com'
    const session=connect(`https://${host}`,{rejectUnauthorized:true,...(c.kind==='apns-p12'?{key:c.privateKey,cert:c.certificate+'\n'+c.chain}:{})})
    const remove=()=>{if(this.cache.get(key)?.session===session)this.cache.delete(key)}
    const ready=new Promise<ClientHttp2Session>((resolve,reject)=>{session.once('connect',()=>resolve(session));session.once('error',()=>reject(Error('CONNECT_FAILED')));session.once('close',()=>reject(Error('CONNECTION_CLOSED')))})
    session.on('error',remove);session.once('close',remove);session.once('goaway',()=>{remove();session.close()})
    this.cache.set(key,{credentialId:config.credentialId,session,ready});return ready
  }
  async invalidate(credentialId:string):Promise<void>{for(const [key,e] of this.cache)if(e.credentialId===credentialId){this.cache.delete(key);e.session.destroy()}}
  async close():Promise<void>{for(const e of this.cache.values())e.session.destroy();this.cache.clear()}
}
