import { randomUUID } from 'node:crypto'
import type { SendSnapshot, SendReceipt } from '../../shared/contracts'
import { StateStore } from '../storage/state-store'
import { scopeKey } from '../config/scope'
export class HistoryService {
  constructor(private store: StateStore) {}
  async start(snapshot: SendSnapshot): Promise<void> {
    await this.store.update((s) => {
      s.history = [
        { snapshot: structuredClone(snapshot), status: 'sending' as const, elapsedMs: 0, persisted: true },
        ...s.history,
      ]
        .sort((a, b) => b.snapshot.startedAt.localeCompare(a.snapshot.startedAt))
        .slice(0, 100)
      const key = scopeKey(snapshot.scope),
        token = s.tokens.find((t) => scopeKey(t.scope) === key && t.token === snapshot.token)
      if (token) token.lastUsedAt = snapshot.startedAt
      else
        s.tokens.push({
          id: randomUUID(),
          scope: snapshot.scope,
          token: snapshot.token,
          note: '',
          createdAt: snapshot.startedAt,
          lastUsedAt: snapshot.startedAt,
        })
      s.selections[key] = s.tokens.find((t) => scopeKey(t.scope) === key && t.token === snapshot.token)!.id
      return s
    })
  }
  async finish(receipt: SendReceipt): Promise<void> {
    await this.store.update((s) => {
      s.history = s.history.map((r) => (r.snapshot.id === receipt.snapshot.id ? structuredClone(receipt) : r))
      return s
    })
  }
  async list(): Promise<SendReceipt[]> {
    return (await this.store.read()).history
  }
  async recoverInterrupted(): Promise<void> {
    const s = await this.store.read()
    if (!s.history.some((h) => h.status === 'sending')) return
    await this.store.update((current) => {
      for (const h of current.history)
        if (h.status === 'sending') {
          h.status = 'unknown'
          h.detail = '上次发送期间工具退出，无法确认请求是否被接受；不会自动重发。'
        }
      return current
    })
  }
}
