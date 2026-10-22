import type { Result } from '../shared/contracts'
import { fail,ok } from '../shared/result'
export class AppFault extends Error { constructor(public code:string,message:string,public field?:string){super(message)} }
export async function guarded<T>(work:()=>Promise<T>):Promise<Result<T>> {try{return ok(await work())}catch(e){return e instanceof AppFault?fail(e.code,e.message,e.field):fail('LOCAL_OPERATION_FAILED','操作未完成，请检查系统加密状态、文件权限或重新导入凭据',undefined,true)}}
