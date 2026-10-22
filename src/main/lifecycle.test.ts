import { EventEmitter } from 'node:events'
import { expect,it,vi } from 'vitest'
import { installShutdownFlush } from './lifecycle'
it('退出等待持久化，重复退出不创建第二次刷新',async()=>{const app=Object.assign(new EventEmitter(),{quit:vi.fn()});let release!:()=>void;const flush=vi.fn(()=>new Promise<void>(r=>{release=r}));installShutdownFlush(app as any,flush,()=>{});app.emit('before-quit',{preventDefault(){}});app.emit('before-quit',{preventDefault(){}});expect(app.quit).not.toHaveBeenCalled();expect(flush).toHaveBeenCalledTimes(1);release();await new Promise(r=>setTimeout(r,0));expect(app.quit).toHaveBeenCalledTimes(1)})
it('刷新失败取消退出并报告错误',async()=>{const app=Object.assign(new EventEmitter(),{quit:vi.fn()});const fail=vi.fn();installShutdownFlush(app as any,async()=>{throw Error('保存失败')},fail);app.emit('before-quit',{preventDefault(){}});await new Promise(r=>setTimeout(r,0));expect(app.quit).not.toHaveBeenCalled();expect(fail).toHaveBeenCalledTimes(1)})
