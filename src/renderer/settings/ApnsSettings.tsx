import type { IosConfig, CredentialSummary } from '../../shared/contracts'
import { CredentialInfo } from './FcmSettings'
export function ApnsSettings({
  value,
  onChange,
  credential,
  password,
  setPassword,
  onImport,
}: {
  value: IosConfig
  onChange: (v: IosConfig) => void
  credential?: CredentialSummary
  password: string
  setPassword: (s: string) => void
  onImport: () => void
}) {
  return (
    <>
      <h2>iOS 推送</h2>
      <p className="muted">直接连接 Apple APNs，按当前环境使用 sandbox 或 production。</p>
      <label className="field">
        Bundle ID
        <input
          value={value.bundleId}
          onChange={(e) => onChange({ ...value, bundleId: e.target.value })}
          placeholder="com.example.app"
        />
      </label>
      <label className="field">
        鉴权方式
        <select
          value={value.authKind}
          onChange={(e) =>
            onChange({ ...value, authKind: e.target.value as 'p8' | 'p12', credentialId: undefined })
          }
        >
          <option value="p8">.p8 签名密钥</option>
          <option value="p12">.p12 推送证书</option>
        </select>
      </label>
      {value.authKind === 'p8' ? (
        <div className="form-grid">
          <label className="field">
            Key ID
            <input
              value={value.keyId || ''}
              onChange={(e) => onChange({ ...value, keyId: e.target.value.trim() })}
            />
          </label>
          <label className="field">
            Team ID
            <input
              value={value.teamId || ''}
              onChange={(e) => onChange({ ...value, teamId: e.target.value.trim() })}
            />
          </label>
        </div>
      ) : (
        <label className="field">
          证书密码
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      )}
      <button className="secondary" onClick={onImport}>
        {value.authKind === 'p8' ? '导入 .p8 密钥' : '导入 .p12 证书'}
      </button>
      <CredentialInfo credential={credential} />
    </>
  )
}
