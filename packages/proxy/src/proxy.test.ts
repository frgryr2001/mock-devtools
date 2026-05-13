import { describe, expect, test, vi } from 'vitest'
import type { PersistedProxyState } from './proxy'
import { handleProxyFetch } from './proxy'

const state: PersistedProxyState = {
  enabled: true,
  logPassThrough: false,
  backendOrigin: 'https://api.example.test',
  routes: [
    {
      id: 'users',
      enabled: true,
      method: 'GET',
      urlPattern: '/api/users/:id',
      requestHeaders: [],
      response: {
        status: 200,
        headers: { 'x-mock': 'yes' },
        shape: 'object',
        body: { id: 'mocked-user' },
      },
    },
  ],
}

describe('handleProxyFetch', () => {
  test('returns mocked responses for matching routes', async () => {
    const forwardFetch = vi.fn()

    const response = await handleProxyFetch(new Request('http://localhost:5055/api/users/1'), state, forwardFetch)

    expect(response.status).toBe(200)
    expect(response.headers.get('x-mock')).toBe('yes')
    expect(await response.json()).toEqual({ id: 'mocked-user' })
    expect(forwardFetch).not.toHaveBeenCalled()
  })

  test('forwards unmatched requests to the configured backend origin', async () => {
    const forwardFetch = vi.fn(async (request: Request) => {
      expect(request.url).toBe('https://api.example.test/api/teams?active=true')
      return new Response(JSON.stringify({ source: 'backend' }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      })
    })

    const response = await handleProxyFetch(new Request('http://localhost:5055/api/teams?active=true'), state, forwardFetch)

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({ source: 'backend' })
  })

  test('matches POST body conditions before mocking', async () => {
    const forwardFetch = vi.fn(async () => new Response('backend', { status: 209 }))
    const postState: PersistedProxyState = {
      ...state,
      routes: [
        {
          ...state.routes[0]!,
          method: 'POST',
          urlPattern: '/api/users',
          requestBody: { operator: 'contains', json: { role: 'admin' } },
          response: { status: 201, headers: {}, shape: 'object', body: { ok: true } },
        },
      ],
    }

    const matched = await handleProxyFetch(
      new Request('http://localhost:5055/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada', role: 'admin' }),
      }),
      postState,
      forwardFetch,
    )
    const unmatched = await handleProxyFetch(
      new Request('http://localhost:5055/api/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Ada', role: 'member' }),
      }),
      postState,
      forwardFetch,
    )

    expect(matched.status).toBe(201)
    expect(await matched.json()).toEqual({ ok: true })
    expect(unmatched.status).toBe(209)
    expect(forwardFetch).toHaveBeenCalledOnce()
  })

  test('returns a clear error when no backend origin is configured for pass-through', async () => {
    const response = await handleProxyFetch(new Request('http://localhost:5055/api/native'), {
      ...state,
      backendOrigin: '',
      routes: [],
    })

    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({ error: 'Proxy backend origin is not configured.' })
  })
})
