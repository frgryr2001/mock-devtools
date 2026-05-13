import { fileURLToPath } from 'node:url'
import type { MockDevtoolsViteOptions } from './index'
import { schemaResolverEndpoint } from './schemaResolver'

export const virtualClientId = '/@mock-devtools/client'
export const virtualServiceWorkerId = '/mock-devtools-sw.js'

export function createVirtualClientModule(options: MockDevtoolsViteOptions): string {
  const uiOptions = {
    position: options.ui?.position,
    defaultOpen: options.ui?.defaultOpen,
    serviceWorkerUrl: virtualServiceWorkerId,
    schemaResolverUrl: schemaResolverEndpoint,
  }

  const uiEntry = fileURLToPath(new URL('../node_modules/@mock-devtools/ui/dist/index.js', import.meta.url))
  const uiCss = uiEntry.replace(/index\.js$/, 'index.css')

  return [
    `import ${JSON.stringify(uiCss)}`,
    `import { mountMockDevtoolsUi } from ${JSON.stringify(uiEntry)}`,
    `mountMockDevtoolsUi(${JSON.stringify(uiOptions)})`,
    '',
  ].join('\n')
}

export function createVirtualServiceWorkerModule(): string {
  return `
let state = { enabled: false, routes: [], logPassThrough: false }

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'MOCK_DEVTOOLS_SYNC_STATE') {
    state = event.data.state
  }
})

self.addEventListener('fetch', (event) => {
  if (!state.enabled) {
    return
  }

  event.respondWith(handleFetchEvent(event.request))
})

async function handleFetchEvent(request) {
  const requestJson = await readJsonRequestBody(request)
  const route = state.routes.find((candidate) =>
    matchRoute(candidate, {
      method: request.method,
      url: new URL(request.url),
      headers: request.headers,
      json: requestJson,
      backendOrigin: state.backendOrigin,
    }).matched,
  )

  if (!route) {
    return fetch(request)
  }

  return handleMockedRequest(request, route)
}

async function handleMockedRequest(request, route) {
  const startedAt = performance.now()

  try {
    await waitForDelay(route.delayMs)
    const built = buildMockResponse(route)
    const response = new Response(serializeBody(built.body), { status: built.status, headers: built.headers })
    await notifyClients({
      method: request.method,
      url: request.url,
      routeId: route.id,
      mocked: true,
      status: built.status,
      durationMs: elapsed(startedAt),
    })
    return response
  } catch (error) {
    await notifyClients({
      method: request.method,
      url: request.url,
      routeId: route.id,
      mocked: false,
      durationMs: elapsed(startedAt),
      error: error instanceof Error ? error.message : 'Unknown mock error.',
    })
    return fetch(request)
  }
}

async function readJsonRequestBody(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) {
    return undefined
  }

  try {
    return await request.clone().json()
  } catch {
    return undefined
  }
}

async function notifyClients(entry) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'MOCK_DEVTOOLS_LOG', entry })
  }
}

function serializeBody(body) {
  if (body === undefined) {
    return null
  }
  return JSON.stringify(body)
}

function elapsed(startedAt) {
  return Math.round(performance.now() - startedAt)
}

async function waitForDelay(delay) {
  const ms = typeof delay === 'number' ? delay : delay ? delay.min : 0
  if (ms <= 0) {
    return
  }
  await new Promise((resolve) => setTimeout(resolve, ms))
}

function buildMockResponse(route) {
  const response = route.response
  const headers =
    response.status === 204
      ? { ...response.headers }
      : { 'content-type': 'application/json', ...response.headers }

  if (response.status >= 400 && response.errorBody !== undefined) {
    return { status: response.status, headers, body: response.errorBody }
  }

  if (response.body !== undefined) {
    return { status: response.status, headers, body: response.body }
  }

  if (response.shape === 'empty') {
    return { status: response.status, headers, body: undefined }
  }

  if (response.shape === 'null') {
    return { status: response.status, headers, body: null }
  }

  if (response.shape === 'array') {
    const count = response.itemCount ?? 10
    return { status: response.status, headers, body: Array.from({ length: count }, () => ({})) }
  }

  if (response.shape === 'paginated') {
    const pageSize = response.itemCount ?? 10
    return {
      status: response.status,
      headers,
      body: {
        data: Array.from({ length: pageSize }, () => ({})),
        meta: { page: 1, pageSize, total: 42 },
      },
    }
  }

  return { status: response.status, headers, body: {} }
}

function matchRoute(route, input) {
  if (!route.enabled) {
    return { matched: false }
  }

  if (route.method.toLowerCase() !== input.method.toLowerCase()) {
    return { matched: false }
  }

  if (!matchesHeaders(route.requestHeaders, input.headers)) {
    return { matched: false }
  }

  if (!matchesBody(route.requestBody, input.json)) {
    return { matched: false }
  }

  const normalizedBackendOrigin = normalizeOrigin(input.backendOrigin)
  if (normalizedBackendOrigin && !route.urlPattern.startsWith('http') && input.url.origin !== normalizedBackendOrigin) {
    return { matched: false }
  }

  const patternTarget = route.urlPattern.startsWith('http')
    ? \`\${input.url.origin}\${input.url.pathname}\`
    : input.url.pathname
  const match = matchPath(route.urlPattern, patternTarget)

  if (!match) {
    return { matched: false }
  }

  return {
    matched: true,
    params: match,
    query: Object.fromEntries(input.url.searchParams.entries()),
  }
}

function normalizeOrigin(value) {
  if (!value?.trim()) {
    return undefined
  }

  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

function matchesBody(matcher, json) {
  if (!matcher) {
    return true
  }

  if (json === undefined) {
    return false
  }

  if (matcher.operator === 'equals') {
    return deepEqual(json, matcher.json)
  }

  return containsValue(json, matcher.json)
}

function matchesHeaders(matchers, headers) {
  return matchers.every((matcher) => {
    const headerValue = headers.get(matcher.name)

    if (matcher.operator === 'exists') {
      return headerValue !== null
    }

    if (headerValue === null || matcher.value === undefined) {
      return false
    }

    if (matcher.operator === 'equals') {
      return headerValue === matcher.value
    }

    if (matcher.operator === 'contains') {
      return headerValue.includes(matcher.value)
    }

    if (matcher.operator === 'startsWith') {
      return headerValue.startsWith(matcher.value)
    }

    try {
      return new RegExp(matcher.value).test(headerValue)
    } catch {
      return false
    }
  })
}

function deepEqual(left, right) {
  if (Object.is(left, right)) {
    return true
  }

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false
    }
    return left.every((item, index) => deepEqual(item, right[index]))
  }

  if (!isRecord(left) || !isRecord(right)) {
    return false
  }

  const leftEntries = Object.entries(left)
  const rightEntries = Object.entries(right)

  if (leftEntries.length !== rightEntries.length) {
    return false
  }

  return leftEntries.every(([key, value]) => key in right && deepEqual(value, right[key]))
}

function containsValue(candidate, subset) {
  if (Object.is(candidate, subset)) {
    return true
  }

  if (Array.isArray(subset)) {
    if (!Array.isArray(candidate) || candidate.length < subset.length) {
      return false
    }
    return subset.every((item, index) => containsValue(candidate[index], item))
  }

  if (!isRecord(subset)) {
    return deepEqual(candidate, subset)
  }

  if (!isRecord(candidate)) {
    return false
  }

  return Object.entries(subset).every(([key, value]) => key in candidate && containsValue(candidate[key], value))
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function matchPath(pattern, pathname) {
  const patternSegments = trimSlashes(pattern).split('/').filter(Boolean)
  const pathSegments = trimSlashes(pathname).split('/').filter(Boolean)
  const params = {}

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index]
    const pathSegment = pathSegments[index]

    if (patternSegment === '*') {
      return params
    }

    if (pathSegment === undefined) {
      return undefined
    }

    if (patternSegment?.startsWith(':')) {
      params[patternSegment.slice(1)] = decodeURIComponent(pathSegment)
      continue
    }

    if (patternSegment !== pathSegment) {
      return undefined
    }
  }

  return patternSegments.length === pathSegments.length ? params : undefined
}

function trimSlashes(value) {
  return value.replace(/^\\/+|\\/+$/g, '')
}
`
}
