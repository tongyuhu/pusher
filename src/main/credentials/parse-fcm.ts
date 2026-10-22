import { createPrivateKey } from 'node:crypto'
import type { CredentialSecret } from './types'
export function parseFcm(bytes:Buffer):CredentialSecret {
  const v=JSON.parse(bytes.toString('utf8'))
  if(v.type!=='service_account'||typeof v.project_id!=='string'||!v.project_id||typeof v.client_email!=='string'||!v.client_email.includes('@')||typeof v.private_key!=='string')throw Error('无效服务账号')
  if(createPrivateKey(v.private_key).asymmetricKeyType!=='rsa')throw Error('无效私钥')
  return {kind:'fcm',projectId:v.project_id,clientEmail:v.client_email,privateKey:v.private_key}
}
