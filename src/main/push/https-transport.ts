import https from 'node:https'
import type { ProviderRequest, Transport, WireResponse } from './types'
import { DispatchFailure } from './errors'
export class HttpsTransport implements Transport {
  async request(input: ProviderRequest, signal: AbortSignal): Promise<WireResponse> {
    if (signal.aborted || !input.url.startsWith('https://'))
      throw new DispatchFailure('not-started', 'INVALID_OR_ABORTED')
    return new Promise((resolve, reject) => {
      let mayHaveSent = false,
        finished = false
      const fail = (code: string) => {
        if (finished) return
        finished = true
        reject(new DispatchFailure(mayHaveSent ? 'may-have-been-sent' : 'not-started', code))
      }
      const req = https.request(
        input.url,
        {
          method: input.method,
          headers: input.headers,
          agent: false,
          rejectUnauthorized: true,
          ...input.tls,
          signal,
        },
        (res) => {
          const chunks: Buffer[] = []
          let length = 0
          res.on('data', (c: Buffer) => {
            length += c.length
            if (length > 65536) {
              fail('RESPONSE_TOO_LARGE')
              req.destroy()
              return
            }
            chunks.push(c)
          })
          res.on('aborted', () => fail('RESPONSE_ABORTED'))
          res.on('error', () => fail('RESPONSE_ERROR'))
          res.on('end', () => {
            if (finished) return
            finished = true
            resolve({
              status: res.statusCode || 0,
              headers: Object.fromEntries(
                Object.entries(res.headers).map(([k, v]) => [
                  k,
                  Array.isArray(v) ? v.join(',') : String(v || ''),
                ]),
              ),
              body: Buffer.concat(chunks).toString('utf8'),
            })
          })
        },
      )
      req.on('socket', (socket) =>
        socket.once('secureConnect', () => {
          mayHaveSent = true
        }),
      )
      req.on('error', (error) => fail((error as NodeJS.ErrnoException).code || 'NETWORK_ERROR'))
      req.end(input.body)
    })
  }
}
