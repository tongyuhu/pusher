import { z } from 'zod'
const object = z.record(z.string(), z.unknown())
export const environmentSchema = z.enum(['test', 'production'])
export const scopeSchema = z.discriminatedUnion('platform', [
  z.object({ platform: z.literal('android'), environment: environmentSchema, packageName: z.string().min(1), projectId: z.string().min(1) }).strict(),
  z.object({ platform: z.literal('ios'), environment: environmentSchema, bundleId: z.string().min(1) }).strict()
])
export const draftSchema = z.object({ platform: z.enum(['android', 'ios']), revision: z.number().int().nonnegative(), mode: z.enum(['form', 'json']), messageType: z.enum(['notification', 'data', 'mixed']), rawText: z.string().max(1024 * 1024), lastValidPayload: object, advanced: object, formStash: object }).strict()
export const sendInputSchema = z.object({ scope: scopeSchema, configRevision: z.number().int().nonnegative(), token: z.string().trim().min(1).max(8192), draft: draftSchema }).strict().refine(v => v.scope.platform === v.draft.platform, { message: '消息平台与目标不一致' })
export const settingsSchema = z.object({ expectedRevision: z.number().int().nonnegative(), displayName: z.string().trim().min(1).max(100), android: z.object({ test: z.object({ packageName: z.string(), credentialId: z.string().optional() }).strict(), production: z.object({ packageName: z.string(), credentialId: z.string().optional() }).strict() }).strict(), ios: z.object({ test: z.object({ bundleId: z.string(), authKind: z.enum(['p8','p12']), keyId: z.string().optional(), teamId: z.string().optional(), credentialId: z.string().optional() }).strict(), production: z.object({ bundleId: z.string(), authKind: z.enum(['p8','p12']), keyId: z.string().optional(), teamId: z.string().optional(), credentialId: z.string().optional() }).strict() }).strict() }).strict()
