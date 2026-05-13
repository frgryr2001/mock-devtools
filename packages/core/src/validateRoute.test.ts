import { describe, expect, it } from 'vitest'
import type { MockRoute } from './types'
import { validateRoute } from './validateRoute'

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
  },
}

describe('validateRoute', () => {
  it('reports invalid delay ranges', () => {
    const issues = validateRoute({ ...route, delayMs: { min: 500, max: 100 } })

    expect(issues).toContainEqual({
      path: 'delayMs',
      message: 'Delay range min must be less than or equal to max.',
    })
  })

  it('reports status codes outside the HTTP range', () => {
    expect(validateRoute({ ...route, response: { ...route.response, status: 99 } })).toContainEqual({
      path: 'response.status',
      message: 'Status must be an integer between 100 and 599.',
    })
    expect(validateRoute({ ...route, response: { ...route.response, status: 600 } })).toContainEqual({
      path: 'response.status',
      message: 'Status must be an integer between 100 and 599.',
    })
  })

  it('reports invalid header matcher regex', () => {
    const issues = validateRoute({
      ...route,
      requestHeaders: [{ name: 'x-role', operator: 'matches', value: '[' }],
    })

    expect(issues).toContainEqual({
      path: 'requestHeaders.0.value',
      message: 'Header matcher regex is invalid.',
    })
  })
})
