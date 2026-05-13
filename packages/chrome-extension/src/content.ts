import type { PersistedMockDevtoolsState } from '@mock-devtools/browser-runtime'
import { mountMockDevtoolsUi, type MountedMockDevtoolsUi } from '@mock-devtools/ui'
import type { ChromeStorageChange } from './chromeTypes'
import { getSiteOrigin } from './siteAccess'

const enabledSitesKey = 'mock-devtools:enabled-sites'
const uiStorageKey = 'mock-devtools'
const enableSiteMessageType = 'MOCK_DEVTOOLS_ENABLE_SITE_CHANGED'
const syncStateMessageType = 'MOCK_DEVTOOLS_EXTENSION_SYNC_STATE'
const hostId = 'mock-devtools-extension-root'
const styleId = 'mock-devtools-extension-style'
const mainWorldScriptId = 'mock-devtools-main-world'

let mounted: MountedMockDevtoolsUi | undefined

void initializeContentScript()

async function initializeContentScript(): Promise<void> {
  injectMainWorldScript()

  if (await isCurrentSiteEnabled()) {
    mountUi()
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!isEnableSiteMessage(message)) {
      return
    }

    const origin = getSiteOrigin(globalThis.location.href)
    if (message.origin !== origin) {
      return
    }

    if (message.enabled) {
      mountUi()
      return
    }

    unmountUi()
  })

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !isEnabledSitesChange(changes[enabledSitesKey])) {
      return
    }

    void syncMountState()
  })
}

async function syncMountState(): Promise<void> {
  if (await isCurrentSiteEnabled()) {
    mountUi()
    return
  }

  unmountUi()
}

async function isCurrentSiteEnabled(): Promise<boolean> {
  const origin = getSiteOrigin(globalThis.location.href)
  if (!origin) {
    return false
  }

  const result = await chrome.storage.local.get<{ [enabledSitesKey]?: string[] }>(enabledSitesKey)
  const enabledSites = Array.isArray(result[enabledSitesKey]) ? result[enabledSitesKey] : []
  return enabledSites.includes(origin)
}

function mountUi(): void {
  if (mounted) {
    return
  }

  injectStylesheet()
  const host = getOrCreateHost()
  mounted = mountMockDevtoolsUi({
    target: host,
    defaultOpen: true,
    storageKey: uiStorageKey,
    onStateChange: syncRuntimeState,
  })
  syncRuntimeState(readStoredState())
}

function unmountUi(): void {
  mounted?.unmount()
  mounted = undefined
  document.querySelector(`#${hostId}`)?.remove()
  syncRuntimeState({ enabled: false, routes: [], logPassThrough: false, backendOrigin: '' })
}

function getOrCreateHost(): HTMLElement {
  const existing = document.querySelector<HTMLElement>(`#${hostId}`)
  if (existing) {
    return existing
  }

  const host = document.createElement('div')
  host.id = hostId
  document.documentElement.append(host)
  return host
}

function injectStylesheet(): void {
  if (document.querySelector(`#${styleId}`)) {
    return
  }

  const link = document.createElement('link')
  link.id = styleId
  link.rel = 'stylesheet'
  link.href = chrome.runtime.getURL('ui.css')
  document.documentElement.append(link)
}

function injectMainWorldScript(): void {
  if (document.querySelector(`#${mainWorldScriptId}`)) {
    return
  }

  const script = document.createElement('script')
  script.id = mainWorldScriptId
  script.type = 'module'
  script.src = chrome.runtime.getURL('main-world.js')
  document.documentElement.append(script)
}

function syncRuntimeState(state: PersistedMockDevtoolsState | undefined): void {
  void syncProxyState(state)
  globalThis.window.postMessage(
    {
      type: syncStateMessageType,
      state: state ?? { enabled: false, routes: [], logPassThrough: false, backendOrigin: '' },
    },
    '*',
  )
}

async function syncProxyState(state: PersistedMockDevtoolsState | undefined): Promise<void> {
  if (!state?.proxySyncUrl?.trim()) {
    return
  }

  try {
    await fetch(state.proxySyncUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(state),
    })
  } catch {
    // Proxy sync is optional; keep local mocking usable if the proxy is offline.
  }
}

function readStoredState(): PersistedMockDevtoolsState | undefined {
  try {
    const value = globalThis.localStorage.getItem(uiStorageKey)
    return value ? (JSON.parse(value) as PersistedMockDevtoolsState) : undefined
  } catch {
    return undefined
  }
}

function isEnableSiteMessage(value: unknown): value is { type: typeof enableSiteMessageType; origin: string; enabled: boolean } {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<{ type: string; origin: string; enabled: boolean }>
  return candidate.type === enableSiteMessageType && typeof candidate.origin === 'string' && typeof candidate.enabled === 'boolean'
}

function isEnabledSitesChange(value: ChromeStorageChange | undefined): boolean {
  return Array.isArray(value?.newValue) || Array.isArray(value?.oldValue)
}
