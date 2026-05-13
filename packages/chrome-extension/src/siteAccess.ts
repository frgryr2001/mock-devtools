const injectableProtocols = new Set(['http:', 'https:'])

export function isInjectableUrl(value: string | undefined): boolean {
  if (!value) {
    return false
  }

  try {
    return injectableProtocols.has(new URL(value).protocol)
  } catch {
    return false
  }
}

export function getSiteOrigin(value: string | undefined): string | undefined {
  if (!value || !isInjectableUrl(value)) {
    return undefined
  }

  return new URL(value).origin
}
