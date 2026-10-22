import forge from 'node-forge'
import { createPrivateKey,createPublicKey,X509Certificate } from 'node:crypto'
import type { CredentialSecret } from './types'
export function parseP12(bytes:Buffer,password=''):CredentialSecret {
  const pfx=forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(bytes.toString('binary')),password)
  const bags=pfx.getBags({bagType:forge.pki.oids.pkcs8ShroudedKeyBag})[forge.pki.oids.pkcs8ShroudedKeyBag]||[]
  const plain=pfx.getBags({bagType:forge.pki.oids.keyBag})[forge.pki.oids.keyBag]||[]
  const keys=[...bags,...plain].filter(b=>b.key)
  const certs=(pfx.getBags({bagType:forge.pki.oids.certBag})[forge.pki.oids.certBag]||[]).flatMap(b=>b.cert?[forge.pki.certificateToPem(b.cert)]:[])
  for(const bag of keys){
    const privateKey=forge.pki.privateKeyToPem(bag.key!)
    const publicDer=createPublicKey(createPrivateKey(privateKey)).export({type:'spki',format:'der'})
    for(const certificate of certs){const cert=new X509Certificate(certificate);if(!publicDer.equals(cert.publicKey.export({type:'spki',format:'der'})))continue
      if(Date.parse(cert.validTo)<=Date.now()||Date.parse(cert.validFrom)>Date.now())throw Error('证书不在有效期')
      return {kind:'apns-p12',privateKey,certificate,chain:certs.filter(c=>c!==certificate).join('\n'),originalBase64:bytes.toString('base64'),password,expiresAt:new Date(cert.validTo).toISOString()}
    }
  }
  throw Error('没有匹配的证书和私钥')
}
