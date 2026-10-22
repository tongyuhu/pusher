import { useState } from 'react'
import type { SendReceipt } from '../../shared/contracts'
import { statusNames } from './SendResult'
import { maskToken } from './TargetPicker'
export function HistoryList({
  history,
  onLoad,
  onView,
}: {
  history: SendReceipt[]
  onLoad: (r: SendReceipt) => void
  onView: (r: SendReceipt) => void
}) {
  const [all, setAll] = useState(false)
  return (
    <section className="history-section">
      <div className="section-heading">
        <h3>最近发送</h3>
        {history.length > 3 && (
          <button className="text-button" onClick={() => setAll(!all)}>
            {all ? '收起' : `全部 ${history.length} 条`}
          </button>
        )}
      </div>
      {history.length ? (
        (all ? history : history.slice(0, 3)).map((r) => (
          <div className="history-row" key={r.snapshot.id}>
            <span className={`history-dot ${r.status}`} />
            <button className="history-summary" onClick={() => onView(r)}>
              <strong>
                {r.snapshot.scope.platform === 'ios' ? 'iOS' : 'Android'} ·{' '}
                {r.snapshot.scope.environment === 'test' ? '测试' : '生产'}
              </strong>
              <small>
                {statusNames[r.status]} · {maskToken(r.snapshot.token)}
              </small>
            </button>
            <span className="subtle">
              {new Date(r.snapshot.startedAt).toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })}
            </span>
            <button className="text-button" onClick={() => onLoad(r)}>
              载入编辑
            </button>
          </div>
        ))
      ) : (
        <p className="history-empty">还没有发送记录。最近 100 条实际发送尝试会保存在本机。</p>
      )}
    </section>
  )
}
