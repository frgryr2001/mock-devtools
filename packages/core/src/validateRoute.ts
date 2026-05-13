import type { DelayRange, MockRoute } from './types'

export interface ValidationIssue {
  path: string
  message: string
}

export function validateRoute(route: MockRoute): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!route.id) {
    issues.push({ path: 'id', message: 'Route id is required.' })
  }
  if (!route.method) {
    issues.push({ path: 'method', message: 'Route method is required.' })
  }
  if (!route.urlPattern) {
    issues.push({ path: 'urlPattern', message: 'Route URL pattern is required.' })
  }
  if (!Number.isInteger(route.response.status) || route.response.status < 100 || route.response.status > 599) {
    issues.push({ path: 'response.status', message: 'Status must be an integer between 100 and 599.' })
  }

  validateDelay(route.delayMs, issues)
  route.requestHeaders.forEach((matcher, index) => {
    if (matcher.operator !== 'exists' && !matcher.value) {
      issues.push({
        path: `requestHeaders.${index}.value`,
        message: 'Header matcher value is required.',
      })
    }
    if (matcher.operator === 'matches' && matcher.value) {
      try {
        new RegExp(matcher.value)
      } catch {
        issues.push({
          path: `requestHeaders.${index}.value`,
          message: 'Header matcher regex is invalid.',
        })
      }
    }
  })

  return issues
}

function validateDelay(delay: number | DelayRange | undefined, issues: ValidationIssue[]): void {
  if (delay === undefined) {
    return
  }

  if (typeof delay === 'number') {
    if (delay < 0) {
      issues.push({ path: 'delayMs', message: 'Delay must be greater than or equal to 0.' })
    }
    return
  }

  if (delay.min < 0 || delay.max < 0) {
    issues.push({ path: 'delayMs', message: 'Delay range values must be greater than or equal to 0.' })
  }
  if (delay.min > delay.max) {
    issues.push({ path: 'delayMs', message: 'Delay range min must be less than or equal to max.' })
  }
}
