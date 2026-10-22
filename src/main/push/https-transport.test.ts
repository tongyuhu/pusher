import { expect,it } from 'vitest'
import { HttpsTransport } from './https-transport'
it('拒绝非 HTTPS 与已经取消的业务请求',async()=>{const t=new HttpsTransport();const c=new AbortController();c.abort();await expect(t.request({url:'https://fcm.googleapis.com',method:'POST',headers:{},body:Buffer.from('{}')},c.signal)).rejects.toMatchObject({evidence:'not-started'});await expect(t.request({url:'http://example.test',method:'POST',headers:{},body:Buffer.from('{}')},new AbortController().signal)).rejects.toMatchObject({evidence:'not-started'})})
