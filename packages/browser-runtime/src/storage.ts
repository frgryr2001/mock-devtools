import type { MockRoute } from '@mock-devtools/core'

export interface PersistedMockDevtoolsState {
  enabled: boolean
  routes: MockRoute[]
  logPassThrough: boolean
  backendOrigin?: string
  proxySyncUrl?: string
}

export function loadState(storage: Storage, key: string): PersistedMockDevtoolsState | undefined {
  const value = storage.getItem(key)
  if (!value) {
    return undefined
  }

  try {
    const parsed = JSON.parse(value) as unknown
    if (!isState(parsed)) {
      return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

export function saveState(storage: Storage, key: string, state: PersistedMockDevtoolsState): void {
  storage.setItem(key, JSON.stringify(state))
}

function isState(value: unknown): value is PersistedMockDevtoolsState {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<PersistedMockDevtoolsState>
  return (
    typeof candidate.enabled === 'boolean' &&
    Array.isArray(candidate.routes) &&
    typeof candidate.logPassThrough === 'boolean' &&
    (candidate.backendOrigin === undefined || typeof candidate.backendOrigin === 'string') &&
    (candidate.proxySyncUrl === undefined || typeof candidate.proxySyncUrl === 'string')
  )
}
