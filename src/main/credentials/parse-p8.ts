import { createPrivateKey } from 'node:crypto'
import type { CredentialSecret } from './types'
export function parseP8(bytes:Buffer):CredentialSecret {
  const privateKey=bytes.toString('utf8'),key=createPrivateKey(privateKey)
  if(key.asymmetricKeyType!=='ec'||key.asymmetricKeyDetails?.namedCurve!=='prime256v1')throw Error('无效密钥曲线')
  return {kind:'apns-p8',privateKey}
}
