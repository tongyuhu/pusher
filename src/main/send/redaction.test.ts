import { expect,it } from 'vitest'
import { redact } from './redaction'
it('删除原文与 JSON 转义的秘密，不保留 bearer',()=>{const key='line1\nline2';const result=redact('bearer actual-jwt '+JSON.stringify({key,token:'device-secret'}),[key,'device-secret']);expect(result).not.toContain('actual-jwt');expect(result).not.toContain('line1');expect(result).not.toContain('device-secret')})
