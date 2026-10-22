import { expect,it } from 'vitest'
import { generateKeyPairSync,verify } from 'node:crypto'
import { signProviderToken } from './jwt'
it('生成 Apple ES256 JWT，签名采用 P1363 且 iat 为 UTC 秒',()=>{const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});const token=signProviderToken({keyId:'KEY1234567',teamId:'TEAM123456',privateKey:privateKey.export({type:'pkcs8',format:'pem'}).toString(),nowSeconds:1700000000});const [h,p,s]=token.split('.');expect(JSON.parse(Buffer.from(h,'base64url').toString())).toEqual({alg:'ES256',kid:'KEY1234567'});expect(JSON.parse(Buffer.from(p,'base64url').toString())).toEqual({iss:'TEAM123456',iat:1700000000});expect(verify('sha256',Buffer.from(h+'.'+p),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url'))).toBe(true)})
