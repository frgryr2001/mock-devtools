export interface ChromeTab {
  id?: number
  url?: string
}

export interface ChromeStorageChange<T = unknown> {
  oldValue?: T
  newValue?: T
}

export interface ChromeApi {
  runtime: {
    getURL(path: string): string
    sendMessage?(message: unknown): Promise<unknown> | void
    onMessage: {
      addListener(
        callback: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean | void,
      ): void
    }
  }
  storage: {
    local: {
      get<T extends Record<string, unknown>>(keys?: string | string[] | Record<string, unknown> | null): Promise<T>
      set(items: Record<string, unknown>): Promise<void>
    }
    onChanged: {
      addListener(callback: (changes: Record<string, ChromeStorageChange>, areaName: string) => void): void
    }
  }
  tabs?: {
    query(queryInfo: Record<string, unknown>): Promise<ChromeTab[]>
    sendMessage(tabId: number, message: unknown): Promise<unknown>
  }
}

declare global {
  const chrome: ChromeApi
}
