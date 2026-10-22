import path from 'node:path'
import type { Result } from '../shared/contracts'
export function resolveAssetPath(url: string, root: string): Result<string> {
  const denied: Result<string> = { ok: false, error: { code: 'INVALID_RESOURCE', message: '资源路径无效', retryable: false } }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'app:' || parsed.host !== 'pusher') return denied
    const pathname = decodeURIComponent(parsed.pathname)
    if (pathname.includes('\0') || pathname.includes('\\')) return denied
    const target = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    const relative = path.relative(path.resolve(root), target)
    if (relative.startsWith('..') || path.isAbsolute(relative)) return denied
    return { ok: true, value: target }
  } catch { return denied }
}
