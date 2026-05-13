export type MockHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface DelayRange {
  min: number
  max: number
}

export interface HeaderMatcher {
  name: string
  operator: 'exists' | 'equals' | 'contains' | 'startsWith' | 'matches'
  value?: string
}

export interface BodyMatcher {
  operator: 'equals' | 'contains'
  json: unknown
}

export interface MockResponseConfig {
  status: number
  headers: Record<string, string>
  shape: 'object' | 'array' | 'paginated' | 'empty' | 'null'
  body?: unknown
  schemaName?: string
  schemaSource?: string
  itemCount?: number
  errorBody?: unknown
}

export interface MockRoute {
  id: string
  enabled: boolean
  method: MockHttpMethod
  urlPattern: string
  requestHeaders: HeaderMatcher[]
  requestBody?: BodyMatcher
  delayMs?: number | DelayRange
  response: MockResponseConfig
}

export interface RouteMatchInput {
  method: string
  url: URL
  headers: Headers
  json?: unknown
  backendOrigin?: string
}

export type RouteMatchResult =
  | {
      matched: true
      params: Record<string, string>
      query: Record<string, string>
    }
  | {
      matched: false
    }
