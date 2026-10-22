import { sign } from 'node:crypto'
export function signProviderToken(input: {
  keyId: string
  teamId: string
  privateKey: string
  nowSeconds: number
}): string {
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: input.keyId })).toString('base64url'),
    payload = Buffer.from(JSON.stringify({ iss: input.teamId, iat: input.nowSeconds })).toString('base64url'),
    text = `${header}.${payload}`
  return `${text}.${sign('sha256', Buffer.from(text), { key: input.privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
}
