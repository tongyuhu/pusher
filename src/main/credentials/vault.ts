import type { CredentialKind,Result } from '../../shared/contracts'
import type { CredentialSecret } from './types'
import { ok,fail } from '../../shared/result'
import { parseFcm } from './parse-fcm'
import { parseP8 } from './parse-p8'
import { parseP12 } from './parse-p12'
export function parseCredential(kind:CredentialKind,bytes:Buffer,password?:string):Result<CredentialSecret>{
  if(bytes.length>4*1024*1024)return fail('CREDENTIAL_TOO_LARGE','凭据文件不能超过 4 MiB')
  try{return ok(kind==='fcm'?parseFcm(bytes):kind==='apns-p8'?parseP8(bytes):parseP12(bytes,password))}
  catch{return fail('INVALID_CREDENTIAL',kind==='fcm'?'服务账号 JSON 无效：请导入 Firebase 服务账号私钥，不是 google-services.json':kind==='apns-p8'?'密钥无效：需要 APNs 的 P-256 .p8 私钥':'证书解析失败：请检查密码、有效期及文件是否包含匹配的私钥')}
}
