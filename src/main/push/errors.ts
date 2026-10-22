export class DispatchFailure extends Error {constructor(public evidence:'not-started'|'may-have-been-sent',public code:string){super(code)}}
export async function abortable<T>(operation:Promise<T>,signal:AbortSignal):Promise<T>{
  if(signal.aborted)throw new DispatchFailure('not-started','ABORTED')
  let abort!:()=>void
  const stopped=new Promise<never>((_resolve,reject)=>{abort=()=>reject(new DispatchFailure('not-started','ABORTED'));signal.addEventListener('abort',abort,{once:true})})
  try{return await Promise.race([operation,stopped])}finally{signal.removeEventListener('abort',abort)}
}
