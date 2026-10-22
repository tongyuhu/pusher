import { EventEmitter } from 'node:events'
import { expect,it } from 'vitest'
import { Http2Transport } from './http2-transport'
const request:any={url:'https://api.push.apple.com/3/device/aa',method:'POST',headers:{},body:Buffer.from('{}')}
it('未建立连接失败和已创建流中断具有不同证据',async()=>{const c:any={credentialId:'one'};await expect(new Http2Transport({get:async()=>{throw Error('connect')},invalidate:async()=>{}} as any,c).request(request,new AbortController().signal)).rejects.toMatchObject({evidence:'not-started'});const stream=Object.assign(new EventEmitter(),{rstCode:8,end(){queueMicrotask(()=>stream.emit('close'))},close(){}});const t=new Http2Transport({get:async()=>({request:()=>stream}),invalidate:async()=>{}} as any,c);await expect(t.request(request,new AbortController().signal)).rejects.toMatchObject({evidence:'may-have-been-sent'})})
