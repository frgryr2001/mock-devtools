import type { ChromeTab } from './chromeTypes'
import { getSiteOrigin, isInjectableUrl } from './siteAccess'

const enabledSitesKey = 'mock-devtools:enabled-sites'
const messageType = 'MOCK_DEVTOOLS_ENABLE_SITE_CHANGED'

type EnabledSitesState = Record<typeof enabledSitesKey, string[] | undefined>

const originElement = document.querySelector<HTMLParagraphElement>('#origin')
const statusElement = document.querySelector<HTMLParagraphElement>('#status')
const toggleButton = document.querySelector<HTMLButtonElement>('#toggle')

void initializePopup()

async function initializePopup(): Promise<void> {
  const tab = await getCurrentTab()
  const origin = getSiteOrigin(tab?.url)

  if (!origin || !tab?.id || !isInjectableUrl(tab.url)) {
    renderUnsupported(tab?.url)
    return
  }

  const enabledSites = await getEnabledSites()
  renderSupported(origin, enabledSites.includes(origin))

  toggleButton?.addEventListener('click', () => {
    void toggleSite(tab.id as number, origin)
  })
}

async function getCurrentTab(): Promise<ChromeTab | undefined> {
  const [tab] = (await chrome.tabs?.query({ active: true, currentWindow: true })) ?? []
  return tab
}

async function getEnabledSites(): Promise<string[]> {
  const result = await chrome.storage.local.get<EnabledSitesState>(enabledSitesKey)
  return Array.isArray(result[enabledSitesKey]) ? result[enabledSitesKey] : []
}

async function toggleSite(tabId: number, origin: string): Promise<void> {
  const enabledSites = await getEnabledSites()
  const enabled = !enabledSites.includes(origin)
  const nextSites = enabled ? [...enabledSites, origin] : enabledSites.filter((candidate) => candidate !== origin)
  await chrome.storage.local.set({ [enabledSitesKey]: nextSites })
  await chrome.tabs?.sendMessage(tabId, { type: messageType, origin, enabled }).catch(() => undefined)
  renderSupported(origin, enabled)
}

function renderUnsupported(url: string | undefined): void {
  if (originElement) {
    originElement.textContent = url ? `Cannot inject into ${url}` : 'Cannot read the current tab.'
  }
  if (statusElement) {
    statusElement.textContent = 'Open a normal http or https app tab to enable Mock DevTools.'
  }
  if (toggleButton) {
    toggleButton.disabled = true
    toggleButton.textContent = 'Unavailable on this page'
  }
}

function renderSupported(origin: string, enabled: boolean): void {
  if (originElement) {
    originElement.textContent = origin
  }
  if (statusElement) {
    statusElement.textContent = enabled ? 'The route studio will be injected on this site.' : 'Mock DevTools is off for this site.'
  }
  if (toggleButton) {
    toggleButton.disabled = false
    toggleButton.dataset.enabled = String(enabled)
    toggleButton.textContent = enabled ? 'Disable this site' : 'Enable this site'
  }
}
