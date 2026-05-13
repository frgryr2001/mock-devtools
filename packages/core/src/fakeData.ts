import { faker } from '@faker-js/faker'
import type { ParsedSchema, SchemaField } from './schema'

export interface GenerateFakeDataOptions {
  count?: number
  seed?: number
}

export function generateFakeData(schema: ParsedSchema, options: GenerateFakeDataOptions = {}): unknown {
  faker.seed(options.seed ?? 0)
  const count = options.count

  if (count !== undefined) {
    return Array.from({ length: count }, (_, index) => {
      faker.seed((options.seed ?? 0) + index)
      return buildObject(schema.fields, (options.seed ?? 0) + index)
    })
  }

  return buildObject(schema.fields, options.seed ?? 0)
}

function buildObject(fields: SchemaField[], seed: number): Record<string, unknown> {
  return Object.fromEntries(fields.map((field) => [field.name, buildValue(field, seed)]))
}

function buildValue(field: SchemaField, seed: number): unknown {
  if (field.kind === 'object') {
    return buildObject(field.children ?? [], seed)
  }

  if (field.kind === 'array') {
    return [field.item ? buildValue(field.item, seed) : null]
  }

  if (field.kind === 'union') {
    const values = field.values ?? []
    return values.length > 0 ? values[Math.abs(seed) % values.length] : ''
  }

  if (field.kind === 'number') {
    return seed
  }

  if (field.kind === 'boolean') {
    return seed % 2 === 0
  }

  return stringForField(field.name, seed)
}

function stringForField(name: string, seed: number): string {
  const normalized = name.toLowerCase()

  if (normalized === 'email') {
    return faker.internet.email().toLowerCase()
  }
  if (['name', 'firstname', 'lastname'].includes(normalized)) {
    return faker.person.fullName()
  }
  if (normalized === 'id' || normalized.endsWith('id')) {
    return faker.string.uuid()
  }
  if (normalized === 'createdat' || normalized === 'updatedat') {
    return faker.date.recent({ days: 30 }).toISOString()
  }
  if (['avatarurl', 'imageurl', 'url'].includes(normalized)) {
    return faker.image.url()
  }
  if (normalized.includes('status')) {
    return 'active'
  }

  return faker.lorem.words({ min: 1, max: 3 }) || `${name}-${seed}`
}
