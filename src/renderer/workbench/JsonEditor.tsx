import CodeMirror from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
const extensions = [json()]
export function JsonEditor({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <div className="json-editor">
      <label>消息 JSON</label>
      <p className="hint">只编辑消息内容；目标 token、环境和鉴权由工具补充。</p>
      <CodeMirror
        value={value}
        height="330px"
        extensions={extensions}
        onChange={onChange}
        basicSetup={{ foldGutter: true, highlightActiveLine: true }}
        aria-label="消息 JSON"
      />
    </div>
  )
}
