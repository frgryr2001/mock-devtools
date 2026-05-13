import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MockRoute } from '@mock-devtools/core'
import { createMockDevtoolsRuntime } from './runtime'
import { readRequestContext } from './requestContext'

const route: MockRoute = {
  id: 'users',
  enabled: true,
  method: 'GET',
  urlPattern: '/api/users/:id',
  requestHeaders: [],
  response: {
    status: 200,
    headers: {},
    shape: 'object',
  },
}

const originalFetch = globalThis.fetch
const originalXhr = globalThis.XMLHttpRequest

afterEach(() => {
  globalThis.fetch = originalFetch
  globalThis.XMLHttpRequest = originalXhr
  vi.restoreAllMocks()
})

describe('createMockDevtoolsRuntime', () => {
  it('returns a mocked fetch response for matching routes', async () => {
    const runtime = createMockDevtoolsRuntime({ routes: [route], enabled: true })
    runtime.start()

    const response = await fetch('https://app.test/api/users/1')

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({})
    expect(runtime.getLogs()[0]).toMatchObject({ mocked: true, routeId: 'users', status: 200 })
    runtime.stop()
  })

  it('uses backend origin override when matching mocked fetch responses', async () => {
    const fetchSpy = vi.fn(async () => new Response('native', { status: 202 }))
    globalThis.fetch = fetchSpy as typeof fetch
    const runtime = createMockDevtoolsRuntime({
      routes: [route],
      enabled: true,
      backendOrigin: 'https://api.example.test',
    })
    runtime.start()

    const matched = await fetch('https://api.example.test/api/users/1')
    const unmatched = await fetch('https://other.example.test/api/users/1')

    expect(matched.status).toBe(200)
    expect(await matched.json()).toEqual({})
    expect(unmatched.status).toBe(202)
    expect(fetchSpy).toHaveBeenCalledOnce()
    runtime.stop()
  })

  it('passes unmatched fetch requests through to the original fetch', async () => {
    const fetchSpy = vi.fn(async () => new Response('native', { status: 202 }))
    globalThis.fetch = fetchSpy as typeof fetch
    const runtime = createMockDevtoolsRuntime({ routes: [route], enabled: true, logPassThrough: true })
    runtime.start()

    const response = await fetch('https://app.test/api/other')

    expect(response.status).toBe(202)
    expect(fetchSpy).toHaveBeenCalledOnce()
    expect(runtime.getLogs()[0]).toMatchObject({ mocked: false, status: 202 })
    runtime.stop()
  })

  it('matches mocked fetch responses by JSON body subset', async () => {
    const fetchSpy = vi.fn(async () => new Response('native', { status: 202 }))
    globalThis.fetch = fetchSpy as typeof fetch
    const runtime = createMockDevtoolsRuntime({
      routes: [
        {
          ...route,
          method: 'POST',
          urlPattern: '/api/users',
          requestBody: { operator: 'contains', json: { role: 'admin' } },
          response: { status: 201, headers: {}, shape: 'object', body: { ok: true } },
        },
      ],
      enabled: true,
    })
    runtime.start()

    const matched = await fetch('https://app.test/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', role: 'admin' }),
    })
    const unmatched = await fetch('https://app.test/api/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', role: 'member' }),
    })

    expect(matched.status).toBe(201)
    expect(await matched.json()).toEqual({ ok: true })
    expect(unmatched.status).toBe(202)
    expect(fetchSpy).toHaveBeenCalledOnce()
    runtime.stop()
  })

  it('returns a mocked XMLHttpRequest response for matching routes', async () => {
    const runtime = createMockDevtoolsRuntime({ routes: [route], enabled: true })
    runtime.start()

    const result = await sendXhr('GET', 'https://app.test/api/users/1')

    expect(result.status).toBe(200)
    expect(JSON.parse(result.body)).toEqual({})
    runtime.stop()
  })

  it('uses backend origin override when matching XMLHttpRequest responses', async () => {
    const runtime = createMockDevtoolsRuntime({
      routes: [route],
      enabled: true,
      backendOrigin: 'https://api.example.test',
    })
    runtime.start()

    const result = await sendXhr('GET', 'https://api.example.test/api/users/1')

    expect(result.status).toBe(200)
    expect(JSON.parse(result.body)).toEqual({})
    runtime.stop()
  })

  it('passes unmatched XMLHttpRequest requests through to the original implementation', async () => {
    class NativeXhr {
      status = 209
      responseText = 'native-xhr'
      onload: (() => void) | null = null
      open(): void {}
      send(): void {
        this.onload?.()
      }
    }
    globalThis.XMLHttpRequest = NativeXhr as unknown as typeof XMLHttpRequest
    const runtime = createMockDevtoolsRuntime({ routes: [route], enabled: true })
    runtime.start()

    const result = await sendXhr('GET', 'https://app.test/api/other')

    expect(result).toEqual({ status: 209, body: 'native-xhr' })
    runtime.stop()
  })

  it('reads FormData upload file metadata', async () => {
    const body = new FormData()
    body.set('asset', new File(['hello'], 'avatar.png', { type: 'image/png' }))

    const context = await readRequestContext('POST', new URL('https://app.test/api/upload'), new Headers(), body)

    expect(context.files).toEqual([{ fieldName: 'asset', name: 'avatar.png', type: 'image/png', size: 5 }])
  })

  it('logs route errors instead of throwing into the host app', async () => {
    const fetchSpy = vi.fn(async () => new Response('native', { status: 203 }))
    globalThis.fetch = fetchSpy as typeof fetch
    const runtime = createMockDevtoolsRuntime({
      routes: [{ ...route, response: { ...route.response, shape: 'broken' as 'object' } }],
      enabled: true,
    })
    runtime.start()

    const response = await fetch('https://app.test/api/users/1')

    expect(response.status).toBe(203)
    expect(runtime.getLogs()[0]?.error).toContain('Unsupported response shape')
    runtime.stop()
  })
})

function sendXhr(method: string, url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText })
    xhr.send()
  })
}
