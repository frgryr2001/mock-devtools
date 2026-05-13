import { buildMockResponse, matchRoute, type DelayRange, type MockRoute } from '@mock-devtools/core'

export interface MockDevtoolsRuntimeOptions {
  routes: MockRoute[]
  enabled: boolean
  logPassThrough?: boolean
  backendOrigin?: string
  storageKey?: string
  serviceWorkerUrl?: string
}

export interface RequestLogEntry {
  id: string
  timestamp: number
  method: string
  url: string
  routeId?: string
  mocked: boolean
  status?: number
  durationMs: number
  error?: string
}

export interface MockDevtoolsRuntime {
  start(): void
  stop(): void
  update(options: Partial<MockDevtoolsRuntimeOptions>): void
  getLogs(): RequestLogEntry[]
  clearLogs(): void
}

export function createMockDevtoolsRuntime(options: MockDevtoolsRuntimeOptions): MockDevtoolsRuntime {
  let currentOptions = { ...options }
  let started = false
  let originalFetch: typeof fetch | undefined
  let OriginalXhr: typeof XMLHttpRequest | undefined
  let serviceWorkerRegistration: ServiceWorkerRegistration | undefined
  const logs: RequestLogEntry[] = []

  function addLog(entry: Omit<RequestLogEntry, 'id' | 'timestamp'>): void {
    logs.unshift({
      id: `log-${Date.now()}-${logs.length}`,
      timestamp: Date.now(),
      ...entry,
    })
  }

  function handleServiceWorkerMessage(event: MessageEvent): void {
    if (event.data?.type !== 'MOCK_DEVTOOLS_LOG') {
      return
    }
    addLog(event.data.entry)
  }

  function syncServiceWorkerState(): void {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    const worker =
      serviceWorkerRegistration?.active ??
      serviceWorkerRegistration?.waiting ??
      serviceWorkerRegistration?.installing ??
      navigator.serviceWorker.controller
    worker?.postMessage({
      type: 'MOCK_DEVTOOLS_SYNC_STATE',
      state: {
        enabled: currentOptions.enabled,
        routes: currentOptions.routes,
        logPassThrough: currentOptions.logPassThrough ?? false,
        ...(currentOptions.backendOrigin ? { backendOrigin: currentOptions.backendOrigin } : {}),
      },
    })
  }

  async function startServiceWorker(): Promise<void> {
    if (!currentOptions.serviceWorkerUrl || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      startFetchInterceptors()
      return
    }

    try {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
      serviceWorkerRegistration = await navigator.serviceWorker.register(currentOptions.serviceWorkerUrl, {
        scope: '/',
        type: 'module',
      })
      await navigator.serviceWorker.ready
      if (!navigator.serviceWorker.controller) {
        await waitForController()
      }
      syncServiceWorkerState()
    } catch {
      navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      startFetchInterceptors()
    }
  }

  function waitForController(): Promise<void> {
    if (navigator.serviceWorker.controller) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      const timeout = globalThis.setTimeout(() => {
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        resolve()
      }, 1000)

      function handleControllerChange(): void {
        globalThis.clearTimeout(timeout)
        navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
        resolve()
      }

      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
    })
  }

  function startFetchInterceptors(): void {
    if (originalFetch) {
      return
    }
    originalFetch = globalThis.fetch
    OriginalXhr = globalThis.XMLHttpRequest
    globalThis.fetch = mockedFetch
    globalThis.XMLHttpRequest = RuntimeXhr as unknown as typeof XMLHttpRequest
  }

  function stopFetchInterceptors(): void {
    if (originalFetch) {
      globalThis.fetch = originalFetch
      originalFetch = undefined
    }
    if (OriginalXhr) {
      globalThis.XMLHttpRequest = OriginalXhr
      OriginalXhr = undefined
    }
  }

  async function mockedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startedAt = performance.now()
    const request = new Request(input, init)
    const requestJson = await readJsonRequestBody(request)
    const route = findRoute(request.method, new URL(request.url), request.headers, requestJson)

    if (!currentOptions.enabled || !route) {
      const response = await originalFetch?.(input, init)
      if (!response) {
        throw new Error('Original fetch is not available.')
      }
      if (currentOptions.logPassThrough) {
        addLog({
          method: request.method,
          url: request.url,
          mocked: false,
          status: response.status,
          durationMs: elapsed(startedAt),
        })
      }
      return response
    }

    try {
      await waitForDelay(route.delayMs)
      const built = buildStrictResponse(route)
      addLog({
        method: request.method,
        url: request.url,
        routeId: route.id,
        mocked: true,
        status: built.status,
        durationMs: elapsed(startedAt),
      })
      return new Response(serializeBody(built.body), { status: built.status, headers: built.headers })
    } catch (error) {
      addLog({
        method: request.method,
        url: request.url,
        routeId: route.id,
        mocked: false,
        durationMs: elapsed(startedAt),
        error: error instanceof Error ? error.message : 'Unknown mock error.',
      })
      const response = await originalFetch?.(input, init)
      if (!response) {
        throw new Error('Original fetch is not available.')
      }
      return response
    }
  }

  function findRoute(method: string, url: URL, headers: Headers, json?: unknown): MockRoute | undefined {
    return currentOptions.routes.find(
      (route) =>
        matchRoute(route, {
          method,
          url,
          headers,
          json,
          ...(currentOptions.backendOrigin ? { backendOrigin: currentOptions.backendOrigin } : {}),
        }).matched,
    )
  }

  function RuntimeXhr(this: XMLHttpRequest): XMLHttpRequest {
    const xhr = OriginalXhr ? new OriginalXhr() : createFallbackXhr()
    let method = 'GET'
    let url = ''

    const originalOpen = xhr.open.bind(xhr)
    xhr.open = ((nextMethod: string, nextUrl: string | URL, async?: boolean, username?: string | null, password?: string | null) => {
      method = nextMethod
      url = String(nextUrl)
      originalOpen(nextMethod, nextUrl, async ?? true, username ?? undefined, password ?? undefined)
    }) as XMLHttpRequest['open']

    const originalSend = xhr.send.bind(xhr)
    xhr.send = ((body?: Document | XMLHttpRequestBodyInit | null) => {
      const startedAt = performance.now()
      const parsedUrl = new URL(url, globalThis.location?.href ?? 'https://app.test')
      const route = currentOptions.enabled ? findRoute(method, parsedUrl, new Headers(), parseJsonBody(body)) : undefined

      if (!route) {
        originalSend(body)
        return
      }

      Promise.resolve()
        .then(() => waitForDelay(route.delayMs))
        .then(() => buildStrictResponse(route))
        .then((built) => {
          Object.defineProperties(xhr, {
            status: { configurable: true, value: built.status },
            responseText: { configurable: true, value: serializeBody(built.body) },
            response: { configurable: true, value: serializeBody(built.body) },
            readyState: { configurable: true, value: 4 },
          })
          addLog({
            method,
            url,
            routeId: route.id,
            mocked: true,
            status: built.status,
            durationMs: elapsed(startedAt),
          })
          xhr.onload?.(createRuntimeEvent('load') as ProgressEvent)
          xhr.onreadystatechange?.(createRuntimeEvent('readystatechange'))
        })
        .catch((error: unknown) => {
          addLog({
            method,
            url,
            routeId: route.id,
            mocked: false,
            durationMs: elapsed(startedAt),
            error: error instanceof Error ? error.message : 'Unknown mock error.',
          })
          originalSend(body)
        })
    }) as XMLHttpRequest['send']

    return xhr
  }

  return {
    start() {
      if (started) {
        return
      }
      started = true
      void startServiceWorker()
    },
    stop() {
      if (!started) {
        return
      }
      stopFetchInterceptors()
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
      }
      started = false
    },
    update(nextOptions) {
      currentOptions = { ...currentOptions, ...nextOptions }
      syncServiceWorkerState()
    },
    getLogs() {
      return [...logs]
    },
    clearLogs() {
      logs.length = 0
    },
  }
}

async function readJsonRequestBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return undefined
  }

  try {
    return await request.clone().json()
  } catch {
    return undefined
  }
}

function parseJsonBody(body: Document | XMLHttpRequestBodyInit | null | undefined): unknown {
  if (typeof body !== 'string') {
    return undefined
  }

  try {
    return JSON.parse(body)
  } catch {
    return undefined
  }
}

function createFallbackXhr(): XMLHttpRequest {
  const xhr = {
    status: 0,
    responseText: '',
    response: '',
    readyState: 0,
    onload: null,
    onreadystatechange: null,
    open() {},
    send() {},
  }

  return xhr as unknown as XMLHttpRequest
}

function createRuntimeEvent(type: string): Event {
  if (typeof Event === 'function') {
    return new Event(type)
  }
  return { type } as Event
}

function buildStrictResponse(route: MockRoute): ReturnType<typeof buildMockResponse> {
  if (!['object', 'array', 'paginated', 'empty', 'null'].includes(route.response.shape)) {
    throw new Error(`Unsupported response shape "${route.response.shape}".`)
  }
  return buildMockResponse(route)
}

function serializeBody(body: unknown): BodyInit | null {
  if (body === undefined) {
    return null
  }
  return JSON.stringify(body)
}

function elapsed(startedAt: number): number {
  return Math.round(performance.now() - startedAt)
}

async function waitForDelay(delay: number | DelayRange | undefined): Promise<void> {
  const ms = typeof delay === 'number' ? delay : delay ? delay.min : 0
  if (ms <= 0) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, ms))
}
