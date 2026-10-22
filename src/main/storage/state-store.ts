import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { CryptoPort } from './crypto-port'
import { emptyState, type AppState } from './types'
import { atomicWrite } from './atomic-file'
export class StateStore {
  private state?: AppState
  private queue: Promise<void> = Promise.resolve()
  private readonly file: string
  constructor(
    root: string,
    private crypto: CryptoPort,
    private write = atomicWrite,
  ) {
    this.file = path.join(root, 'state.v1.enc')
  }
  private async load(): Promise<AppState> {
    if (this.state) return this.state
    let bytes: Buffer
    try {
      bytes = await readFile(this.file)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return (this.state = emptyState())
      throw error
    }
    const decoded = JSON.parse(await this.crypto.decrypt(bytes)) as AppState
    if (decoded.schemaVersion !== 1) throw Error('本地数据版本不兼容，原文件已保留')
    if (
      !decoded.config ||
      !decoded.credentials ||
      !Array.isArray(decoded.tokens) ||
      !Array.isArray(decoded.history) ||
      !decoded.drafts ||
      !decoded.selections
    )
      throw Error('本地数据结构损坏，原文件已保留')
    return (this.state = decoded)
  }
  async read(): Promise<AppState> {
    await this.queue
    return structuredClone(await this.load())
  }
  update(mutator: (current: AppState) => AppState): Promise<void> {
    const operation = this.queue.then(async () => {
      const next = mutator(structuredClone(await this.load()))
      await this.write(this.file, await this.crypto.encrypt(JSON.stringify(next)))
      this.state = next
    })
    this.queue = operation.catch(() => {})
    return operation
  }
  async flush(): Promise<void> {
    await this.queue
  }
}
