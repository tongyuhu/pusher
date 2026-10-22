import { safeStorage } from 'electron'
import type { CryptoPort } from './crypto-port'
async function check() { if (!await safeStorage.isAsyncEncryptionAvailable()) throw Error('系统加密暂不可用，请解锁系统凭据存储后重试') }
export const electronCrypto: CryptoPort = {
  async encrypt(text) { await check(); return safeStorage.encryptStringAsync(text) },
  async decrypt(bytes) { await check(); const decrypted = await safeStorage.decryptStringAsync(bytes); return decrypted.result }
}
