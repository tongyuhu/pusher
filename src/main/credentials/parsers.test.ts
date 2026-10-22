import { expect,it } from 'vitest'
import { generateKeyPairSync } from 'node:crypto'
import { parseCredential } from './vault'
import { parseP12 } from './parse-p12'
import { p8,p12Fixture,fcmFixture } from '../../test/credential-fixtures'
it('导入真实结构的服务账号与 P256 密钥',()=>{expect(parseCredential('fcm',fcmFixture()).ok).toBe(true);expect(parseCredential('apns-p8',Buffer.from(p8())).ok).toBe(true);expect(parseCredential('fcm',Buffer.from('{"project_info":{}}')).ok).toBe(false);const wrong=generateKeyPairSync('ec',{namedCurve:'secp384r1'}).privateKey.export({type:'pkcs8',format:'pem'});expect(parseCredential('apns-p8',Buffer.from(wrong)).ok).toBe(false)})
it('p12 密码、私钥和有效期被校验',()=>{const bytes=p12Fixture();expect(()=>parseP12(bytes,'secret')).not.toThrow();expect(parseCredential('apns-p12',bytes,'secret').ok).toBe(true);expect(parseCredential('apns-p12',bytes,'wrong').ok).toBe(false);expect(parseCredential('apns-p12',p12Fixture('secret',true),'secret').ok).toBe(false);expect(parseCredential('apns-p12',p12Fixture('secret',false,true),'secret').ok).toBe(false)})
it('p12 使用原生 PFX，不解包为另一份明文私钥',()=>{const result=parseP12(p12Fixture(),'secret');expect(result).not.toHaveProperty('privateKey');expect(result).toHaveProperty('originalBase64')})
