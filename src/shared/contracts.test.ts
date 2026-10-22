import { expect, it } from 'vitest'
import { sendInputSchema } from './schemas'
const draft = { platform: 'android', revision: 1, mode: 'form', messageType: 'data', rawText: '{"data":{"type":"test"}}', lastValidPayload: {data:{type:'test'}}, advanced: {}, formStash: {} }
it('拒绝未知平台和不完整发送上下文', () => {
  expect(sendInputSchema.safeParse({ scope: { platform: 'web' } }).success).toBe(false)
  expect(sendInputSchema.safeParse({ scope: { platform: 'android' } }).success).toBe(false)
})
it('完整发送必须有匹配的平台、目标和配置版本', () => {
  const valid = {scope:{platform:'android',environment:'test',packageName:'com.example.app',projectId:'test-project'},configRevision:1,token:'device-token',draft}
  expect(sendInputSchema.safeParse(valid).success).toBe(true)
  expect(sendInputSchema.safeParse({...valid,token:''}).success).toBe(false)
  expect(sendInputSchema.safeParse({...valid,draft:{...draft,platform:'ios'}}).success).toBe(false)
})
