import { createContext,useCallback,useContext,useEffect,useState,type ReactNode,type Dispatch,type SetStateAction } from 'react'
import type { BootstrapSnapshot,CredentialSummary,Draft,Platform,SettingsInput } from '../../shared/contracts'
import { client } from './client'
interface Context {snapshot:BootstrapSnapshot;setSnapshot:Dispatch<SetStateAction<BootstrapSnapshot|undefined>>;drafts:Partial<Record<Platform,Draft>>;setDrafts:Dispatch<SetStateAction<Partial<Record<Platform,Draft>>>>;addCredential:(c:CredentialSummary)=>void;saveSettings:(s:SettingsInput)=>ReturnType<typeof window.pusher.saveSettings>}
const AppContext=createContext<Context|null>(null)
export function AppProvider({children}:{children:ReactNode}){
  const [snapshot,setSnapshot]=useState<BootstrapSnapshot>(),[drafts,setDrafts]=useState<Partial<Record<Platform,Draft>>>({}),[error,setError]=useState('')
  const load=useCallback(async()=>{setError('');try{const r=await client().bootstrap();if(r.ok){setSnapshot(r.value);setDrafts(r.value.drafts)}else setError(r.error.message)}catch{setError('无法连接本地服务，请重新启动工具')}},[])
  useEffect(()=>{void load()},[load])
  if(!snapshot)return <main className="empty"><div className="brand-icon">↗</div><h1>Pusher</h1><p>{error||'正在恢复本地配置…'}</p>{error&&<button className="primary" onClick={()=>void load()}>重试加载</button>}</main>
  return <AppContext.Provider value={{snapshot,setSnapshot,drafts,setDrafts,addCredential:c=>setSnapshot(s=>s?{...s,credentialSummaries:[...s.credentialSummaries.filter(x=>x.id!==c.id),c]}:s),saveSettings:async(input)=>{const r=await client().saveSettings(input);if(r.ok)setSnapshot(s=>s?{...s,config:r.value}:s);return r}}}>{children}</AppContext.Provider>
}
export function useApp(){const value=useContext(AppContext);if(!value)throw Error('缺少 AppProvider');return value}
