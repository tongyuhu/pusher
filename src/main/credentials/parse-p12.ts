import { createSecureContext,TLSSocket } from 'node:tls'
import { Socket } from 'node:net'
import type { CredentialSecret } from './types'
export function parseP12(bytes:Buffer,password=''):CredentialSecret {
  const context=createSecureContext({pfx:bytes,passphrase:password})
  // 只建立内存中的 TLS 对象读取本地证书，不连接任何网络地址。
  const socket=new TLSSocket(new Socket(),{secureContext:context})
  try{
    const certificate=socket.getX509Certificate()
    if(!certificate)throw Error('没有证书')
    if(Date.parse(certificate.validTo)<=Date.now()||Date.parse(certificate.validFrom)>Date.now())throw Error('证书不在有效期')
    return {kind:'apns-p12',originalBase64:bytes.toString('base64'),password,expiresAt:new Date(certificate.validTo).toISOString()}
  }finally{socket.destroy()}
}
