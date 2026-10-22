import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Send, Settings, PanelRight, Smartphone } from 'lucide-react'
import { scopeKey } from '../../shared/scope'
import type { Environment, SendReceipt } from '../../shared/contracts'
import { useWorkbench } from '../state/useWorkbench'
import { TargetPicker } from './TargetPicker'
import { MessageEditor } from './MessageEditor'
import { RequestPreview } from './RequestPreview'
import { SendResult } from './SendResult'
import { HistoryList } from './HistoryList'
export function WorkbenchPage() {
  const w = useWorkbench(),
    { state, draft } = w,
    [viewed, setViewed] = useState<SendReceipt>(),
    [collapsed, setCollapsed] = useState(false)
  const error =
    w.preview && !w.preview.ok ? w.preview.error.message : !w.parsed.ok ? w.parsed.error.message : undefined
  const ready = !!w.scope && w.configured && !!state.token.trim() && !!w.preview?.ok && !state.sending
  const result = state.result || viewed
  return (
    <div className={collapsed ? 'workbench preview-collapsed' : 'workbench'}>
      <header className="workbench-header">
        <div className="logo-lockup">
          <div className="brand-icon">
            <Send size={24} strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div>
            <h1>Pusher</h1>
            <span>把消息送到测试设备</span>
          </div>
        </div>
        <div className="app-identity">
          <small>当前应用</small>
          <strong>{w.snapshot.config.displayName}</strong>
          <span>
            {state.platform === 'ios'
              ? w.snapshot.config.ios[state.environment].bundleId
              : w.snapshot.config.android[state.environment].packageName}
          </span>
        </div>
        <span className="spacer" />
        <select
          aria-label="推送环境"
          className={`environment-select ${state.environment}`}
          value={state.environment}
          onChange={(e) => {
            void w.flushDrafts().catch(() => {})
            w.dispatch({ type: 'selectEnvironment', environment: e.target.value as Environment })
          }}
        >
          <option value="test">● 测试环境</option>
          <option value="production">● 生产环境</option>
        </select>
        <button
          className="text-button preview-toggle"
          aria-label={collapsed ? '显示预览' : '隐藏预览'}
          onClick={() => setCollapsed(!collapsed)}
        >
          <PanelRight size={15} aria-hidden="true" /> 预览
        </button>
        <Link className="settings-link" to="/settings">
          <Settings size={15} aria-hidden="true" /> 设置
        </Link>
      </header>
      <div className="workbench-body">
        <main className="editor-pane">
          <div className="section-heading editor-heading">
            <h2>编辑推送</h2>
            <div className="platform-switch">
              {(['android', 'ios'] as const).map((platform) => (
                <button
                  key={platform}
                  className={state.platform === platform ? 'active' : ''}
                  onClick={() => {
                    void w.flushDrafts().catch(() => {})
                    w.dispatch({ type: 'selectPlatform', platform })
                  }}
                >
                  <Smartphone size={14} aria-hidden="true" />
                  {platform === 'ios' ? 'iOS' : 'Android'}
                </button>
              ))}
            </div>
          </div>
          <TargetPicker
            key={w.scope ? scopeKey(w.scope) : `${state.platform}:${state.environment}`}
            token={state.token}
            tokens={w.tokens}
            onChange={w.setToken}
            onSave={w.saveToken}
            onDelete={(id) => void w.deleteToken(id)}
          />
          {!w.configured && (
            <div className="configuration-hint">
              当前环境尚未配置凭据。<Link to="/settings">前往设置 →</Link>
            </div>
          )}
          <MessageEditor draft={draft} onChange={w.editDraft} onError={w.setFeedback} />
          {collapsed && error && <div className="feedback danger">{error}</div>}
          {(w.feedback || w.saveError) && (
            <div className="feedback" role="status">
              {w.saveError || w.feedback}
            </div>
          )}
          <div className="send-bar">
            <button
              className="primary send-button"
              disabled={!ready}
              onClick={() => {
                setViewed(undefined)
                void w.send()
              }}
            >
              <Send size={16} aria-hidden="true" />
              {state.sending ? '发送中…' : '发送推送'}
            </button>
            <div>
              <span>{state.environment === 'test' ? '测试环境' : '生产环境'} · 单台设备</span>
              <small>
                {!w.configured
                  ? '请先配置推送凭据'
                  : !state.token.trim()
                    ? '请先选择或粘贴 token'
                    : error
                      ? '请修复消息格式'
                      : '服务接受后，请在设备上确认实际表现'}
              </small>
            </div>
          </div>
        </main>
        <aside className="preview-pane">
          <RequestPreview
            preview={w.preview?.ok ? w.preview.value : undefined}
            payload={w.parsed.ok ? w.parsed.value : undefined}
            error={error}
            hasToken={!!state.token.trim()}
          />
          <SendResult receipt={viewed || result} />
          <HistoryList history={w.history} onLoad={w.loadHistory} onView={setViewed} />
        </aside>
      </div>
      <footer className="workbench-footer">
        <span>
          <i className={w.configured ? 'ready-dot' : 'idle-dot'} /> {w.configured ? '凭据已配置' : '等待配置'}
        </span>
        <span>{w.saveError ? '草稿保存未完成' : '配置、token 与草稿在本机保存'}</span>
        <span>Electron · iOS & Android</span>
      </footer>
    </div>
  )
}
