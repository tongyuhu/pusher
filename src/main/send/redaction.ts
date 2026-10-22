export function redact(text: string, secrets: string[]): string {
  let cleaned = text
  for (const secret of [...new Set(secrets)].filter(Boolean).sort((a, b) => b.length - a.length)) {
    cleaned = cleaned
      .split(JSON.stringify(secret).slice(1, -1))
      .join('[已隐藏]')
      .split(secret)
      .join('[已隐藏]')
  }
  return cleaned.replace(/\bbearer\s+[^\s,;"}]+/gi, 'bearer [已隐藏]')
}
