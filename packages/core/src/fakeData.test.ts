import { describe, expect, it } from 'vitest'
import { generateFakeData } from './fakeData'
import type { ParsedSchema } from './schema'

const schema: ParsedSchema = {
  name: 'User',
  fields: [
    { name: 'id', optional: false, kind: 'string' },
    { name: 'email', optional: false, kind: 'string' },
    { name: 'createdAt', optional: false, kind: 'string' },
    { name: 'avatarUrl', optional: false, kind: 'string' },
    { name: 'status', optional: false, kind: 'union', values: ['active', 'inactive'] },
  ],
}

describe('generateFakeData', () => {
  it('maps known field names and union values with faker-backed values', () => {
    expect(generateFakeData(schema, { seed: 1 })).toEqual({
      id: expect.any(String),
      email: expect.stringContaining('@'),
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      avatarUrl: expect.stringMatching(/^https?:\/\//),
      status: 'inactive',
    })
  })

  it('generates arrays with the requested count', () => {
    const result = generateFakeData(schema, { count: 3 })

    expect(result).toEqual([
      expect.objectContaining({ email: expect.stringContaining('@') }),
      expect.objectContaining({ email: expect.stringContaining('@') }),
      expect.objectContaining({ email: expect.stringContaining('@') }),
    ])
  })
})
