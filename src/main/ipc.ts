import { z } from 'zod'
import type { BrowserWindow,IpcMain } from 'electron'
import type { SendInput,SendReceipt,Result } from '../shared/contracts'
import { CHANNELS,channel } from '../shared/channels'
import { draftSchema,scopeSchema,sendInputSchema,settingsSchema } from '../shared/schemas'
import { fail } from '../shared/result'
import { validateSender } from './ipc-guard'
import { guarded } from './errors'
import { bootstrap } from './bootstrap'
import type { ConfigService } from './config/service'
import type { TokenService } from './tokens/service'
import type { StateStore } from './storage/state-store'
export interface IpcServices {window:BrowserWindow;ipcMain:IpcMain;store:StateStore;configService:ConfigService;tokenService:TokenService;allowedOrigin?:string;send?:(input:SendInput)=>Promise<Result<SendReceipt>>}
const scopeId=z.object({scope:scopeSchema,id:z.string().optional()}).strict()
export function registerIpc(deps:IpcServices):()=>void{
  const {window,ipcMain,store,configService:c,tokenService:t}=deps
  const schemas:Record<string,z.ZodType>={bootstrap:z.undefined(),importCredential:z.object({kind:z.enum(['fcm','apns-p8','apns-p12']),password:z.string().max(4096).optional()}).strict(),saveSettings:settingsSchema,listTokens:scopeSchema,saveToken:z.object({scope:scopeSchema,token:z.string().max(8192),note:z.string().max(200)}).strict(),deleteToken:scopeId,selectToken:scopeId,saveDraft:draftSchema,listHistory:z.undefined(),send:sendInputSchema}
  const operations:Record<string,(input:any)=>Promise<Result<unknown>>>={bootstrap:()=>guarded(()=>bootstrap(store)),importCredential:i=>c.importCredential(i),saveSettings:i=>c.saveSettings(i),listTokens:i=>t.list(i),saveToken:i=>t.save(i),deleteToken:i=>t.delete(i),selectToken:i=>t.select(i),saveDraft:()=>Promise.resolve(fail('NOT_READY','草稿服务尚未初始化')),listHistory:()=>guarded(async()=>(await store.read()).history),send:i=>deps.send?deps.send(i):Promise.resolve(fail('NOT_READY','发送服务尚未初始化'))}
  for(const name of CHANNELS)ipcMain.handle(channel(name),async(event,input:unknown)=>{
    if(event.sender!==window.webContents||!validateSender(event.senderFrame?.url||'',event.senderFrame===window.webContents.mainFrame,deps.allowedOrigin||'app://pusher'))return fail('FORBIDDEN','请求来源无效')
    const parsed=schemas[name].safeParse(input);if(!parsed.success)return fail('INVALID_ARGUMENT','请求参数无效，请检查对应输入')
    try{return await operations[name](parsed.data)}catch{return fail('OPERATION_FAILED','操作失败，请重试',undefined,true)}
  })
  const dispose=()=>{for(const name of CHANNELS)ipcMain.removeHandler(channel(name))}
  window.once('closed',dispose);return dispose
}
