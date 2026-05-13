import { describe, expect, it } from 'vitest'
import { buildMockResponse } from './buildMockResponse'
import type { MockRoute } from './types'

const route: MockRoute = {
  id: 'users',
  enabled: true,
  method: 'GET',
  urlPattern: '/api/users',
  requestHeaders: [],
  response: {
    status: 200,
    headers: {},
    shape: 'object',
    itemCount: 2,
  },
}

describe('buildMockResponse', () => {
  it('builds object, array, paginated, empty, and null responses', () => {
    expect(buildMockResponse(route)).toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: {},
    })
    expect(buildMockResponse({ ...route, response: { ...route.response, shape: 'array' } }).body).toEqual([
      {},
      {},
    ])
    expect(buildMockResponse({ ...route, response: { ...route.response, shape: 'paginated' } }).body).toEqual({
      data: [{}, {}],
      meta: { page: 1, pageSize: 2, total: 42 },
    })
    expect(
      buildMockResponse({ ...route, response: { ...route.response, status: 204, shape: 'empty' } }),
    ).toEqual({
      status: 204,
      headers: {},
      body: undefined,
    })
    expect(buildMockResponse({ ...route, response: { ...route.response, shape: 'null' } }).body).toBeNull()
  })

  it('uses fixed response bodies when configured', () => {
    expect(
      buildMockResponse({
        ...route,
        response: {
          ...route.response,
          body: { ok: true },
        },
      }).body,
    ).toEqual({ ok: true })
  })
})
