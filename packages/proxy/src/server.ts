#!/usr/bin/env node
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { MockRoute } from '@mock-devtools/core'
import { handleProxyFetch, type PersistedProxyState } from './proxy'

const stateEndpoint = '/__mock-devtools/state'
const healthEndpoint = '/__mock-devtools/health'
const defaultPort = 5055

let state: PersistedProxyState = {
  enabled: false,
  routes: [],
  logPassThrough: false,
  backendOrigin: process.env.MOCK_DEVTOOLS_BACKEND_ORIGIN ?? '',
}

const server = createServer((request, response) => {
  void handleNodeRequest(request, response)
})

const port = Number.parseInt(process.env.MOCK_DEVTOOLS_PROXY_PORT ?? '', 10) || defaultPort
server.listen(port, () => {
  console.log(`Mock DevTools proxy listening on http://localhost:${port}`)
})

async function handleNodeRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  setCorsHeaders(response)

  if (request.method === 'OPTIONS') {
    response.writeHead(204)
    response.end()
    return
  }

  const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? `localhost:${port}`}`)

  if (requestUrl.pathname === healthEndpoint) {
    writeJson(response, 200, { ok: true, enabled: state.enabled, routes: state.routes.length })
    return
  }

  if (requestUrl.pathname === stateEndpoint) {
    await updateState(request, response)
    return
  }

  const proxyResponse = await handleProxyFetch(toFetchRequest(request, requestUrl), state)
  await writeFetchResponse(response, proxyResponse)
}

async function updateState(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'POST') {
    writeJson(response, 405, { error: 'State endpoint only accepts POST.' })
    return
  }

  try {
    const body = (await readJson(request)) as Partial<PersistedProxyState>
    state = {
      enabled: typeof body.enabled === 'boolean' ? body.enabled : false,
      routes: Array.isArray(body.routes) ? (body.routes as MockRoute[]) : [],
      logPassThrough: typeof body.logPassThrough === 'boolean' ? body.logPassThrough : false,
      backendOrigin: typeof body.backendOrigin === 'string' ? body.backendOrigin : '',
    }
    writeJson(response, 200, { ok: true, routes: state.routes.length })
  } catch {
    writeJson(response, 400, { error: 'State payload must be valid JSON.' })
  }
}

function toFetchRequest(request: IncomingMessage, requestUrl: URL): Request {
  const method = request.method ?? 'GET'
  return new Request(requestUrl, {
    method,
    headers: request.headers as HeadersInit,
    body: method === 'GET' || method === 'HEAD' ? undefined : Readable.toWeb(request) as ReadableStream,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}

async function writeFetchResponse(response: ServerResponse, proxyResponse: Response): Promise<void> {
  response.writeHead(proxyResponse.status, Object.fromEntries(proxyResponse.headers.entries()))
  if (!proxyResponse.body) {
    response.end()
    return
  }

  const reader = proxyResponse.body.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }
    response.write(value)
  }
  response.end()
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function writeJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
  response.setHeader('access-control-allow-headers', '*')
}
