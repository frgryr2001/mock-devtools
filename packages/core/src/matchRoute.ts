import type { HeaderMatcher, MockRoute, RouteMatchInput, RouteMatchResult } from './types'

export function matchRoute(route: MockRoute, input: RouteMatchInput): RouteMatchResult {
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
    ? `${input.url.origin}${input.url.pathname}`
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

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined
  }

  try {
    return new URL(value).origin
  } catch {
    return undefined
  }
}

function matchesBody(matcher: MockRoute['requestBody'], json: unknown): boolean {
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

function matchesHeaders(matchers: HeaderMatcher[], headers: Headers): boolean {
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

function deepEqual(left: unknown, right: unknown): boolean {
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

function containsValue(candidate: unknown, subset: unknown): boolean {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function matchPath(pattern: string, pathname: string): Record<string, string> | undefined {
  const patternSegments = trimSlashes(pattern).split('/').filter(Boolean)
  const pathSegments = trimSlashes(pathname).split('/').filter(Boolean)
  const params: Record<string, string> = {}

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

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}
