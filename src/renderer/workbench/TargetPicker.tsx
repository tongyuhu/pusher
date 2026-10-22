import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Copy, Pencil, Save, Search, Smartphone, Trash2 } from 'lucide-react'
import type { TokenRecord } from '../../shared/contracts'
export const maskToken = (token: string) =>
  token.length > 20 ? token.slice(0, 10) + '…' + token.slice(-7) : token
export function TargetPicker({
  token,
  tokens,
  onChange,
  onSave,
  onDelete,
}: {
  token: string
  tokens: TokenRecord[]
  onChange: (s: string) => void
  onSave: (note: string) => Promise<boolean>
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [edit, setEdit] = useState<{ target: string; text: string }>()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const nameInput = useRef<HTMLInputElement>(null)
  const focusName = useRef(false)
  const target = token.trim()
  const saved = tokens.find((t) => t.token === target)
  const name = edit?.target === target ? edit.text : saved?.note || ''
  const changed = name !== (saved?.note || '')
  useEffect(() => {
    setEdit(undefined)
    setSaveError('')
    if (focusName.current) {
      nameInput.current?.focus()
      nameInput.current?.select()
      focusName.current = false
    }
  }, [target])
  const rename = (record: TokenRecord) => {
    focusName.current = true
    onChange(record.token)
    setOpen(false)
    if (target === record.token) {
      nameInput.current?.focus()
      nameInput.current?.select()
      focusName.current = false
    }
  }
  const save = async () => {
    if (!target || saving || (saved && !changed)) return
    setSaving(true)
    setSaveError('')
    try {
      if (await onSave(name)) {
        // 保存期间仍可继续输入；只清除本次提交的编辑内容。
        setEdit((current) => (current?.target === target && current.text === name ? undefined : current))
      }
    } catch {
      setSaveError('设备名称保存失败，请重试。')
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="target-picker">
      <div className="label-row">
        <label htmlFor="device-token" className="with-icon">
          <Smartphone size={14} aria-hidden="true" />
          目标设备
        </label>
        <div className="token-summary">
          <span className="subtle">已保存 {tokens.length} 台设备</span>
          <button
            className="icon-button"
            aria-label="复制设备 token"
            title="复制设备 token"
            disabled={!target}
            onClick={() => void navigator.clipboard.writeText(token).catch(() => {})}
          >
            <Copy size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="token-select">
        <div className="token-input-row">
          <input
            id="device-token"
            aria-label="设备 token"
            className="control mono"
            value={token}
            placeholder="粘贴设备 token，或从历史中选择"
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
          <button
            className="dropdown-button"
            aria-label="选择已保存设备"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </div>
        {open && (
          <div className="token-menu">
            <div className="token-search">
              <Search size={15} aria-hidden="true" />
              <input
                className="control"
                aria-label="搜索已保存设备"
                placeholder="搜索名称或 token"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            {tokens
              .filter((t) => (t.note + t.token).toLowerCase().includes(query.toLowerCase()))
              .map((t) => (
                <div key={t.id} className="token-option">
                  <button
                    onClick={() => {
                      onChange(t.token)
                      setOpen(false)
                    }}
                  >
                    <strong>{t.note || '未命名设备'}</strong>
                    <small className="mono">
                      {maskToken(t.token)}
                      {t.invalidReason ? ' · 已标记无效' : ''}
                    </small>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`修改 ${t.note || '未命名设备'} 的名称`}
                    title="修改设备名称"
                    onClick={() => rename(t)}
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`删除 ${t.note || '设备'}`}
                    title="删除设备"
                    onClick={() => onDelete(t.id)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              ))}
            {tokens.length === 0 && <p className="hint">还没有保存的设备，粘贴 token 后可添加名称并保存。</p>}
          </div>
        )}
      </div>
      <div className="device-name-row">
        <label className="device-name-field" htmlFor="device-name">
          设备名称（可选）
          <input
            id="device-name"
            ref={nameInput}
            className="control"
            value={name}
            maxLength={200}
            onChange={(e) => setEdit({ target, text: e.target.value })}
            placeholder="例如：我的测试手机"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                void save()
              }
            }}
          />
        </label>
        <button
          className="secondary with-icon save-device"
          disabled={!target || saving || (!!saved && !changed)}
          onClick={() => void save()}
        >
          <Save size={15} aria-hidden="true" />
          {saving ? '保存中…' : saved ? '保存名称' : '保存设备'}
        </button>
      </div>
      {saveError && (
        <p className="feedback danger" role="alert">
          {saveError}
        </p>
      )}
    </div>
  )
}
