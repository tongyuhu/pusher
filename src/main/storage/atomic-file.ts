import { mkdir, open, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
export async function atomicWrite(file: string, data: Buffer): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })
  const temp = `${file}.${randomUUID()}.tmp`
  try {
    const handle = await open(temp, 'wx', 0o600)
    try { await handle.writeFile(data); await handle.sync() } finally { await handle.close() }
    await rename(temp, file)
  } finally { await unlink(temp).catch(() => {}) }
}
