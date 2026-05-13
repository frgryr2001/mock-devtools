import { describe, expect, test } from 'vitest'
import { getSiteOrigin, isInjectableUrl } from './siteAccess'

describe('site access helpers', () => {
  test('allows http and https pages', () => {
    expect(isInjectableUrl('http://localhost:5174/api/users/1')).toBe(true)
    expect(isInjectableUrl('https://app.example.test/dashboard')).toBe(true)
  })

  test('blocks browser and extension pages', () => {
    expect(isInjectableUrl('chrome://extensions')).toBe(false)
    expect(isInjectableUrl('chrome-extension://abc/popup.html')).toBe(false)
    expect(isInjectableUrl('about:blank')).toBe(false)
  })

  test('normalizes enabled site storage to URL origin', () => {
    expect(getSiteOrigin('http://localhost:5174/api/users/1')).toBe('http://localhost:5174')
    expect(getSiteOrigin('https://api.example.test/v1/users')).toBe('https://api.example.test')
  })

  test('returns undefined for non-injectable URLs', () => {
    expect(getSiteOrigin('chrome://extensions')).toBeUndefined()
    expect(getSiteOrigin(undefined)).toBeUndefined()
  })
})
