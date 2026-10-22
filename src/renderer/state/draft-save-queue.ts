import type { Draft, Platform } from '../../shared/contracts'
export class DraftSaveQueue {
  private pending = new Map<Platform, Draft>()
  private saved = new Map<Platform, number>()
  private timer?: ReturnType<typeof setTimeout>
  private running?: Promise<void>
  constructor(
    private save: (draft: Draft) => Promise<void>,
    private onError: (error: unknown) => void = () => {},
    private onSaved: () => void = () => {},
  ) {}
  enqueue(draft: Draft): void {
    if (
      draft.revision <= (this.saved.get(draft.platform) ?? -1) ||
      draft.revision < (this.pending.get(draft.platform)?.revision ?? -1)
    )
      return
    this.pending.set(draft.platform, structuredClone(draft))
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      void this.flush().catch(this.onError)
    }, 500)
  }
  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = undefined
    }
    if (this.running) return this.running
    this.running = (async () => {
      while (this.pending.size) {
        const [platform, draft] = this.pending.entries().next().value!
        await this.save(draft)
        this.saved.set(platform, draft.revision)
        if (this.pending.get(platform)?.revision === draft.revision) this.pending.delete(platform)
      }
      this.onSaved()
    })()
    try {
      await this.running
    } finally {
      this.running = undefined
    }
  }
}
