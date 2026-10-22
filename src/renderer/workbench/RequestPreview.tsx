import type { PreviewRequest, JsonObject } from '../../shared/contracts'
export function RequestPreview({
  preview,
  payload,
  error,
  hasToken,
}: {
  preview?: PreviewRequest
  payload?: JsonObject
  error?: string
  hasToken: boolean
}) {
  const body = preview ? structuredClone(preview.body) : payload
  if (
    preview &&
    !hasToken &&
    body &&
    typeof body.message === 'object' &&
    body.message &&
    !Array.isArray(body.message)
  )
    body.message.token = '<待选择 token>'
  return (
    <section>
      <div className="section-heading">
        <h3>请求预览</h3>
        <span className="format-tag">JSON</span>
      </div>
      {error ? (
        <div className="validation-box" role="alert">
          {error}
          <p>修复后将恢复当前请求预览。</p>
        </div>
      ) : (
        <>
          {preview && (
            <div className="request-destination mono">
              POST {hasToken ? preview.url : preview.url.replace(/\/3\/device\/.+$/, '/3/device/<token>')}
            </div>
          )}
          <pre className="request-code mono" aria-label="请求预览">
            {body ? JSON.stringify(body, null, 2) : '编辑消息后将在此显示请求内容。'}
          </pre>
          <div className="preview-footer">
            <span>{preview ? `${preview.estimatedBytes} 字节 · UTF-8` : '配置完成后展示完整请求'}</span>
            <button
              className="text-button"
              disabled={!body}
              onClick={() =>
                void navigator.clipboard.writeText(JSON.stringify(body, null, 2)).catch(() => {})
              }
            >
              复制消息
            </button>
          </div>
        </>
      )}
    </section>
  )
}
