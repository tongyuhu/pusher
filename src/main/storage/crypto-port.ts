export interface CryptoPort { encrypt(text: string): Promise<Buffer>; decrypt(bytes: Buffer): Promise<string> }
