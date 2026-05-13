import { createMockDevtoolsRuntime, type MockDevtoolsRuntime, type PersistedMockDevtoolsState } from '@mock-devtools/browser-runtime'

const syncStateMessageType = 'MOCK_DEVTOOLS_EXTENSION_SYNC_STATE'

let runtime: MockDevtoolsRuntime | undefined

globalThis.window.addEventListener('message', (event) => {
  if (event.source !== globalThis.window || !isSyncStateMessage(event.data)) {
    return
  }

  syncRuntime(event.data.state)
})

function syncRuntime(state: PersistedMockDevtoolsState): void {
  if (!runtime) {
    runtime = createMockDevtoolsRuntime({
      ...state,
    })
    runtime.start()
    return
  }

  runtime.update(state)
}

function isSyncStateMessage(value: unknown): value is { type: typeof syncStateMessageType; state: PersistedMockDevtoolsState } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<{ type: string; state: Partial<PersistedMockDevtoolsState> }>
  return (
    candidate.type === syncStateMessageType &&
    !!candidate.state &&
    typeof candidate.state.enabled === 'boolean' &&
    Array.isArray(candidate.state.routes) &&
    typeof candidate.state.logPassThrough === 'boolean'
  )
}
