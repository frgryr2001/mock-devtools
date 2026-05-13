import { generateFakeData } from './fakeData'
import type { ParsedSchema } from './schema'
import type { MockRoute } from './types'

export interface BuiltMockResponse {
  status: number
  headers: Record<string, string>
  body: unknown
}

export function buildMockResponse(route: MockRoute, schema?: ParsedSchema): BuiltMockResponse {
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
    return {
      status: response.status,
      headers,
      body: schema ? generateFakeData(schema, { count }) : Array.from({ length: count }, () => ({})),
    }
  }

  if (response.shape === 'paginated') {
    const pageSize = response.itemCount ?? 10
    return {
      status: response.status,
      headers,
      body: {
        data: schema ? generateFakeData(schema, { count: pageSize }) : Array.from({ length: pageSize }, () => ({})),
        meta: { page: 1, pageSize, total: 42 },
      },
    }
  }

  return {
    status: response.status,
    headers,
    body: schema ? generateFakeData(schema) : {},
  }
}
