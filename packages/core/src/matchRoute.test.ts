import { describe, expect, it } from 'vitest'
import { matchRoute } from './matchRoute'
import type { MockRoute } from './types'

const baseRoute: MockRoute = {
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

describe('matchRoute', () => {
  it('matches method, relative URL, and path params', () => {
    const result = matchRoute(baseRoute, {
      method: 'GET',
      url: new URL('https://app.test/api/users/42'),
      headers: new Headers(),
    })

    expect(result).toEqual({
      matched: true,
      params: { id: '42' },
      query: {},
    })
  })

  it('matches relative routes against a configured backend origin', () => {
    const result = matchRoute(baseRoute, {
      method: 'GET',
      url: new URL('https://api.example.test/api/users/42'),
      headers: new Headers(),
      backendOrigin: 'https://api.example.test',
    })

    expect(result).toEqual({
      matched: true,
      params: { id: '42' },
      query: {},
    })
  })

  it('rejects relative routes when a configured backend origin does not match', () => {
    const result = matchRoute(baseRoute, {
      method: 'GET',
      url: new URL('https://other.example.test/api/users/42'),
      headers: new Headers(),
      backendOrigin: 'https://api.example.test',
    })

    expect(result.matched).toBe(false)
  })

  it('tries the next route when a header matcher fails', () => {
    const result = matchRoute(
      {
        ...baseRoute,
        requestHeaders: [{ name: 'x-tenant', operator: 'equals', value: 'acme' }],
      },
      {
        method: 'GET',
        url: new URL('https://app.test/api/users/42'),
        headers: new Headers({ 'x-tenant': 'other' }),
      },
    )

    expect(result.matched).toBe(false)
  })

  it('supports wildcard suffixes', () => {
    const result = matchRoute(
      { ...baseRoute, urlPattern: '/api/admin/*' },
      {
        method: 'GET',
        url: new URL('https://app.test/api/admin/reports/daily'),
        headers: new Headers(),
      },
    )

    expect(result.matched).toBe(true)
  })

  it('matches a route when request body equals the configured JSON body', () => {
    const result = matchRoute(
      {
        ...baseRoute,
        method: 'POST',
        urlPattern: '/api/users',
        requestBody: { operator: 'equals', json: { email: 'user@example.com', name: 'User' } },
      },
      {
        method: 'POST',
        url: new URL('https://app.test/api/users'),
        headers: new Headers(),
        json: { email: 'user@example.com', name: 'User' },
      },
    )

    expect(result.matched).toBe(true)
  })

  it('rejects a route when request body equals does not match exactly', () => {
    const result = matchRoute(
      {
        ...baseRoute,
        method: 'POST',
        urlPattern: '/api/users',
        requestBody: { operator: 'equals', json: { email: 'user@example.com' } },
      },
      {
        method: 'POST',
        url: new URL('https://app.test/api/users'),
        headers: new Headers(),
        json: { email: 'user@example.com', role: 'admin' },
      },
    )

    expect(result.matched).toBe(false)
  })

  it('matches a route when request body contains the configured JSON subset', () => {
    const result = matchRoute(
      {
        ...baseRoute,
        method: 'PATCH',
        urlPattern: '/api/users/:id',
        requestBody: { operator: 'contains', json: { profile: { status: 'active' } } },
      },
      {
        method: 'PATCH',
        url: new URL('https://app.test/api/users/42'),
        headers: new Headers(),
        json: { profile: { status: 'active', displayName: 'Ada' }, role: 'admin' },
      },
    )

    expect(result.matched).toBe(true)
  })

  it('rejects a route when request body does not contain the configured JSON subset', () => {
    const result = matchRoute(
      {
        ...baseRoute,
        method: 'PATCH',
        urlPattern: '/api/users/:id',
        requestBody: { operator: 'contains', json: { profile: { status: 'active' } } },
      },
      {
        method: 'PATCH',
        url: new URL('https://app.test/api/users/42'),
        headers: new Headers(),
        json: { profile: { status: 'inactive' } },
      },
    )

    expect(result.matched).toBe(false)
  })
})
