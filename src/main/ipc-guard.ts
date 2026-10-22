export function validateSender(frameUrl: string, isMainFrame: boolean, allowedOrigin: string): boolean {
  if (!isMainFrame) return false
  try {
    const actual = new URL(frameUrl),
      expected = new URL(allowedOrigin)
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      !actual.username &&
      !actual.password
    )
  } catch {
    return false
  }
}
