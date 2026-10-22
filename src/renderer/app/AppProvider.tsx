import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useReducer,
  useRef,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from 'react'
import type {
  BootstrapSnapshot,
  CredentialSummary,
  Draft,
  Platform,
  SettingsInput,
} from '../../shared/contracts'
import { client } from './client'
import { Send } from 'lucide-react'
import {
  createWorkbenchState,
  workbenchReducer,
  type WorkbenchState,
  type WorkbenchAction,
} from '../state/workbench'
import { DraftSaveQueue } from '../state/draft-save-queue'
interface Context {
  snapshot: BootstrapSnapshot
  setSnapshot: Dispatch<SetStateAction<BootstrapSnapshot | undefined>>
  drafts: Partial<Record<Platform, Draft>>
  setDrafts: Dispatch<SetStateAction<Partial<Record<Platform, Draft>>>>
  state: WorkbenchState
  dispatch: Dispatch<WorkbenchAction>
  flushDrafts: () => Promise<void>
  saveError: string
  tokenSelections: RefObject<Record<string, string>>
  addCredential: (c: CredentialSummary) => void
  saveSettings: (s: SettingsInput) => ReturnType<typeof window.pusher.saveSettings>
}
const AppContext = createContext<Context | null>(null)
export function AppProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<BootstrapSnapshot>(),
    [drafts, setDrafts] = useState<Partial<Record<Platform, Draft>>>({}),
    [error, setError] = useState('')
  const [state, dispatch] = useReducer(workbenchReducer, createWorkbenchState('android')),
    [saveError, setSaveError] = useState('')
  const draftsRef = useRef(drafts)
  // 当前会话的目标选择跨路由保留；未操作过的 scope 使用启动时的持久化选择。
  const tokenSelections = useRef<Record<string, string>>({})
  draftsRef.current = drafts
  const queue = useRef<DraftSaveQueue | null>(null)
  if (!queue.current)
    queue.current = new DraftSaveQueue(
      async (d) => {
        const r = await client().saveDraft(d)
        if (!r.ok) throw Error(r.error.message)
      },
      (e) => setSaveError(e instanceof Error ? e.message : '草稿未保存'),
      () => setSaveError(''),
    )
  const flushDrafts = useCallback(async () => {
    for (const d of Object.values(draftsRef.current)) if (d) queue.current!.enqueue(d)
    try {
      await queue.current!.flush()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '草稿未保存')
      throw e
    }
  }, [])
  const load = useCallback(async () => {
    setError('')
    try {
      const r = await client().bootstrap()
      if (r.ok) {
        setSnapshot(r.value)
        setDrafts(r.value.drafts)
        dispatch({ type: 'restore', platform: r.value.lastPlatform, history: r.value.history })
      } else setError(r.error.message)
    } catch {
      setError('无法连接本地服务，请重新启动工具')
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  useEffect(() => {
    for (const d of Object.values(drafts)) if (d) queue.current!.enqueue(d)
  }, [drafts])
  useEffect(() => client().onBeforeClose(flushDrafts), [flushDrafts])
  useEffect(() => client().onSendUpdate?.((receipt) => dispatch({ type: 'sendUpdate', receipt })), [])
  if (!snapshot)
    return (
      <main className="empty">
        <div className="brand-icon">
          <Send size={28} strokeWidth={1.8} aria-hidden="true" />
        </div>
        <h1>Pusher</h1>
        <p>{error || '正在恢复本地配置…'}</p>
        {error && (
          <button className="primary" onClick={() => void load()}>
            重试加载
          </button>
        )}
      </main>
    )
  return (
    <AppContext.Provider
      value={{
        snapshot,
        setSnapshot,
        drafts,
        setDrafts,
        state,
        dispatch,
        flushDrafts,
        saveError,
        tokenSelections,
        addCredential: (c) =>
          setSnapshot((s) =>
            s ? { ...s, credentialSummaries: [...s.credentialSummaries.filter((x) => x.id !== c.id), c] } : s,
          ),
        saveSettings: async (input) => {
          const r = await client().saveSettings(input)
          if (r.ok) setSnapshot((s) => (s ? { ...s, config: r.value } : s))
          return r
        },
      }}
    >
      {children}
    </AppContext.Provider>
  )
}
export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw Error('缺少 AppProvider')
  return value
}
