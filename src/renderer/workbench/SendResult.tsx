import type { SendReceipt } from '../../shared/contracts'
import { Send, CircleCheck, CircleX, TriangleAlert, LoaderCircle, CircleHelp } from 'lucide-react'
import { maskToken } from './TargetPicker'
export const statusNames = {
  sending: '发送中',
  accepted: '服务已接受',
  rejected: '服务已拒绝',
  'not-sent': '未能发送',
  unknown: '发送状态未知',
}
export function SendResult({ receipt }: { receipt?: SendReceipt }) {
  const StatusIcon = receipt
    ? {
        accepted: CircleCheck,
        rejected: CircleX,
        'not-sent': TriangleAlert,
        sending: LoaderCircle,
        unknown: CircleHelp,
      }[receipt.status]
    : Send
  return (
    <section className="result-section">
      <div className="section-heading">
        <h3>发送结果</h3>
        {receipt && (
          <span className="subtle">
            {new Date(receipt.snapshot.startedAt).toLocaleTimeString('zh-CN', { hour12: false })}
          </span>
        )}
      </div>
      {receipt ? (
        <>
          <div className={`send-result ${receipt.status}`}>
            <div className="result-title">
              <strong className="with-icon">
                <StatusIcon
                  size={17}
                  className={receipt.status === 'sending' ? 'spin' : undefined}
                  aria-hidden="true"
                />
                {statusNames[receipt.status]}
              </strong>
              <span>{receipt.httpStatus || ''}</span>
            </div>
            <p>
              {receipt.detail ||
                (receipt.status === 'sending'
                  ? '正在连接推送服务，请稍候…'
                  : '请结合服务返回信息核对本次发送。')}
            </p>
            {receipt.providerId && <div className="mono result-id">消息 ID：{receipt.providerId}</div>}
            {receipt.providerCode && <div className="mono result-id">错误码：{receipt.providerCode}</div>}
          </div>
          <div className="result-meta">
            <span>
              {receipt.snapshot.scope.platform === 'ios' ? 'iOS' : 'Android'} ·{' '}
              {receipt.snapshot.scope.environment === 'test' ? '测试环境' : '生产环境'}
            </span>
            <span>{receipt.elapsedMs} ms</span>
          </div>
          <div className="hint mono">目标：{maskToken(receipt.snapshot.token)}</div>
          {!receipt.persisted && <p className="feedback danger">结果已返回，但本地记录未保存。</p>}
          <details className="result-details">
            <summary>查看本次请求快照</summary>
            <pre className="mono">{JSON.stringify(receipt.snapshot.request.body, null, 2)}</pre>
          </details>
        </>
      ) : (
        <div className="result-empty">
          <Send size={28} strokeWidth={1.6} aria-hidden="true" />
          <p>准备就绪，等待第一次发送</p>
          <small>推送服务接受请求后，在设备上确认实际表现。</small>
        </div>
      )}
    </section>
  )
}
