import { buildMockResponse, matchRoute, type MockRoute } from '@mock-devtools/core'

export interface PersistedProxyState {
  enabled: boolean
  routes: MockRoute[]
  logPassThrough: boolean
  backendOrigin?: string
}

export type ForwardFetch = (request: Request) => Promise<Response>

export async function handleProxyFetch(
  request: Request,
  state: PersistedProxyState,
  forwardFetch: ForwardFetch = fetch,
): Promise<Response> {
  const requestJson = await readJsonRequestBody(request)
  const requestUrl = new URL(request.url)
  const route = state.enabled
    ? state.routes.find((candidate) =>
        matchRoute(candidate, {
          method: request.method,
          url: requestUrl,
          headers: request.headers,
          json: requestJson,
        }).matched,
      )
    : undefined

  if (route) {
    const built = buildMockResponse(route)
    return new Response(serializeBody(built.body), {
      status: built.status,
      headers: built.headers,
    })
  }

  const backendOrigin = normalizeOrigin(state.backendOrigin)
  if (!backendOrigin) {
    return jsonResponse({ error: 'Proxy backend origin is not configured.' }, 502)
  }

  return forwardFetch(createBackendRequest(request, backendOrigin))
}

export function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  try {
    return new URL(value).origin
  } catch {
    return undefined
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

function createBackendRequest(request: Request, backendOrigin: string): Request {
  const sourceUrl = new URL(request.url)
  const targetUrl = new URL(`${sourceUrl.pathname}${sourceUrl.search}`, backendOrigin)
  return new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.clone().body,
    duplex: 'half',
    redirect: 'manual',
  } as RequestInit & { duplex: 'half' })
}

function serializeBody(body: unknown): BodyInit | null {
  if (body === undefined) {
    return null
  }

  return JSON.stringify(body)
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
