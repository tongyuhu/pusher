interface QuitApp { on(event: 'before-quit', listener: (event: { preventDefault(): void }) => void): unknown; quit(): void }
export function installShutdownFlush(app: QuitApp, flush: () => Promise<void>, onError: (error?:unknown) => void): void {
  let finished = false, flushing = false
  app.on('before-quit', event => {
    if (finished) return
    event.preventDefault()
    if (flushing) return
    flushing = true
    void flush().then(() => { finished = true; app.quit() }).catch(error => { flushing = false; onError(error) })
  })
}
