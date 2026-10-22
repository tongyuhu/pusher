export const CHANNELS = ['bootstrap','importCredential','saveSettings','listTokens','saveToken','deleteToken','selectToken','saveDraft','listHistory','send'] as const
export const channel = (name: string): string => `pusher:${name}`
