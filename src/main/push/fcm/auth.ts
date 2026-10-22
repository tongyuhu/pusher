import { JWT } from 'google-auth-library'
import type { ResolvedConfig } from '../../credentials/types'
import { abortable } from '../errors'
type AccessToken={token:string;expiresAt:number}
async function authorize(c:ResolvedConfig,signal:AbortSignal):Promise<AccessToken>{
  if(c.credential.kind!=='fcm')throw Error('INVALID_CREDENTIAL')
  const jwt=new JWT({email:c.credential.clientEmail,key:c.credential.privateKey,scopes:['https://www.googleapis.com/auth/firebase.messaging'],transporterOptions:{signal,retry:false}})
  const credentials=await jwt.authorize();if(!credentials.access_token)throw Error('EMPTY_ACCESS_TOKEN')
  return {token:credentials.access_token,expiresAt:credentials.expiry_date||Date.now()+3000000}
}
export class FcmAuth {
  private cache=new Map<string,AccessToken>()
  constructor(private fetch=authorize,private now=()=>Date.now()){}
  async get(c:ResolvedConfig,signal:AbortSignal):Promise<string>{if(signal.aborted)throw Error('ABORTED');const existing=this.cache.get(c.credentialId);if(existing&&existing.expiresAt-this.now()>60000)return existing.token;const fresh=await abortable(this.fetch(c,signal),signal);this.cache.set(c.credentialId,fresh);return fresh.token}
  async invalidate(id:string):Promise<void>{this.cache.delete(id)}
}
