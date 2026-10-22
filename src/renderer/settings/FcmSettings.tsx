import type { AndroidConfig, CredentialSummary } from '../../shared/contracts'
import { CircleCheck, Upload } from 'lucide-react'
export function CredentialInfo({ credential }: { credential?: CredentialSummary }) {
  return (
    <div className="credential-info">
      {credential ? (
        <>
          <strong className="with-icon">
            <CircleCheck size={16} aria-hidden="true" />
            {credential.fileName}
          </strong>
          {credential.projectId && <span>项目：{credential.projectId}</span>}
          {credential.clientEmail && <span>{credential.clientEmail}</span>}
          {credential.expiresAt && (
            <span>有效期至：{new Date(credential.expiresAt).toLocaleDateString()}</span>
          )}
          <small>本地导入检查已通过，实际鉴权以发送结果为准。</small>
        </>
      ) : (
        <span>尚未配置凭据</span>
      )}
    </div>
  )
}
export function FcmSettings({
  value,
  onChange,
  credential,
  onImport,
}: {
  value: AndroidConfig
  onChange: (v: AndroidConfig) => void
  credential?: CredentialSummary
  onImport: () => void
}) {
  return (
    <>
      <h2>Android 推送</h2>
      <p className="muted">通过 Firebase Cloud Messaging HTTP v1 发送消息。</p>
      <label className="field">
        Android 包名
        <input
          value={value.packageName}
          onChange={(e) => onChange({ ...value, packageName: e.target.value })}
          placeholder="com.example.app"
        />
      </label>
      <div className="field">
        <label>服务账号 JSON</label>
        <button className="secondary with-icon" onClick={onImport}>
          <Upload size={16} aria-hidden="true" />
          导入 Firebase 密钥
        </button>
        <CredentialInfo credential={credential} />
        <p className="hint">使用 Firebase「项目设置 → 服务账号」生成的私钥 JSON。</p>
      </div>
    </>
  )
}
