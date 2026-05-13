export type SchemaFieldKind = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'union'

export interface SchemaField {
  name: string
  optional: boolean
  kind: SchemaFieldKind
  children?: SchemaField[]
  item?: SchemaField
  values?: string[]
}

export interface ParsedSchema {
  name: string
  fields: SchemaField[]
}

export interface ParseInterfaceSchemaOptions {
  schemaName?: string | undefined
}

interface Token {
  type: 'identifier' | 'string' | 'symbol'
  value: string
}

export function parseInterfaceSchema(source: string, options: ParseInterfaceSchemaOptions = {}): ParsedSchema {
  const tokens = tokenize(source)
  const parser = new SchemaParser(tokens)
  return parser.parse(options.schemaName)
}

export function listTypeSchemaNames(source: string): string[] {
  return scanTypeNames(tokenize(source))
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let index = 0

  while (index < source.length) {
    const char = source[index]

    if (!char || /\s/.test(char)) {
      index += 1
      continue
    }

    if (/[A-Za-z_$]/.test(char)) {
      let value = char
      index += 1
      while (index < source.length && /[A-Za-z0-9_$]/.test(source[index] ?? '')) {
        value += source[index]
        index += 1
      }
      tokens.push({ type: 'identifier', value })
      continue
    }

    if (char === "'" || char === '"') {
      const quote = char
      let value = ''
      index += 1
      while (index < source.length && source[index] !== quote) {
        value += source[index]
        index += 1
      }
      index += 1
      tokens.push({ type: 'string', value })
      continue
    }

    if ('{}?:|[]();,<>=.'.includes(char)) {
      tokens.push({ type: 'symbol', value: char })
      index += 1
      continue
    }

    index += 1
  }

  return tokens
}

class SchemaParser {
  private index = 0
  private readonly schemasByName = new Map<string, ParsedSchema>()

  constructor(private readonly tokens: Token[]) {}

  parse(schemaName?: string): ParsedSchema {
    const schemas = this.parseAll()
    if (schemas.length === 0) {
      throw new Error('Expected an interface or class declaration.')
    }

    if (schemaName) {
      const selected = schemas.find((schema) => schema.name === schemaName)
      if (!selected) {
        throw new Error(`Model "${schemaName}" was not found.`)
      }
      return selected
    }

    return schemas[schemas.length - 1] as ParsedSchema
  }

  private parseAll(): ParsedSchema[] {
    const schemas: ParsedSchema[] = []

    while (this.index < this.tokens.length) {
      if (!this.seekDeclarationStart()) {
        break
      }

      const schema = this.parseDeclaration()
      schemas.push(schema)
      this.schemasByName.set(schema.name, schema)
    }

    return schemas
  }

  private seekDeclarationStart(): boolean {
    while (this.index < this.tokens.length) {
      if (this.peekIdentifier('interface') || this.peekIdentifier('class')) {
        return true
      }
      this.index += 1
    }

    return false
  }

  private parseDeclaration(): ParsedSchema {
    const declarationKind = this.expect('identifier').value
    if (declarationKind !== 'interface' && declarationKind !== 'class') {
      throw new Error('Expected an interface or class declaration.')
    }

    const name = this.expect('identifier').value
    let baseClassName: string | undefined
    while (!this.peekSymbol('{') && this.index < this.tokens.length) {
      if (this.consumeIdentifier('extends') && this.peek('identifier')) {
        baseClassName = this.expect('identifier').value
        continue
      }
      this.index += 1
    }
    this.expectSymbol('{')
    const baseFields = baseClassName ? (this.schemasByName.get(baseClassName)?.fields ?? []) : []
    const fields = this.parseFields()
    this.expectSymbol('}')
    return { name, fields: [...baseFields, ...fields] }
  }

  private parseFields(): SchemaField[] {
    const fields: SchemaField[] = []

    while (!this.peekSymbol('}') && this.index < this.tokens.length) {
      let fieldName = this.expect('identifier').value
      if (isFieldModifier(fieldName) && this.peek('identifier')) {
        fieldName = this.expect('identifier').value
      }
      if (this.peekSymbol('(')) {
        this.skipMemberBody()
        continue
      }
      const optional = this.consumeSymbol('?')
      if (!this.consumeSymbol(':')) {
        this.skipMemberBody()
        continue
      }
      fields.push(this.parseFieldType(fieldName, optional))
      this.consumeSymbol(';')
      this.consumeSymbol(',')
    }

    return fields
  }

  private parseFieldType(name: string, optional: boolean): SchemaField {
    if (this.consumeSymbol('{')) {
      const children = this.parseFields()
      this.expectSymbol('}')
      const objectField: SchemaField = { name, optional, kind: 'object', children }

      if (this.consumeSymbol('[')) {
        this.expectSymbol(']')
        return {
          name,
          optional,
          kind: 'array',
          item: { ...objectField, name: `${name}Item`, optional: false },
        }
      }

      return objectField
    }

    if (this.peek('string')) {
      const values = [this.expect('string').value]
      while (this.consumeSymbol('|')) {
        values.push(this.expect('string').value)
      }
      return { name, optional, kind: 'union', values }
    }

    const primitive = this.expect('identifier').value
    if (primitive === 'Array' && this.consumeSymbol('<')) {
      const item = this.parseFieldType(`${name}Item`, false)
      this.skipUntilSymbol('>')
      this.consumeSymbol('>')
      return { name, optional, kind: 'array', item }
    }

    const baseField = this.fieldFromIdentifier(name, optional, primitive)
    if (this.consumeSymbol('[')) {
      this.expectSymbol(']')
      return { name, optional, kind: 'array', item: { ...baseField, name: `${name}Item`, optional: false } }
    }

    return baseField
  }

  private fieldFromIdentifier(name: string, optional: boolean, identifier: string): SchemaField {
    if (['string', 'number', 'boolean'].includes(identifier)) {
      return { name, optional, kind: identifier as SchemaFieldKind }
    }

    const referencedSchema = this.schemasByName.get(identifier)
    if (referencedSchema) {
      return {
        name,
        optional,
        kind: 'object',
        children: referencedSchema.fields,
      }
    }

    if (this.consumeSymbol('<')) {
      this.skipUntilSymbol('>')
      this.consumeSymbol('>')
    }

    return { name, optional, kind: 'object', children: [] }
  }

  private skipMemberBody(): void {
    while (!this.peekSymbol(';') && !this.peekSymbol('}') && this.index < this.tokens.length) {
      if (this.consumeSymbol('{')) {
        this.skipBalancedBlock()
        continue
      }
      this.index += 1
    }
    this.consumeSymbol(';')
  }

  private skipBalancedBlock(): void {
    let depth = 1
    while (depth > 0 && this.index < this.tokens.length) {
      if (this.consumeSymbol('{')) {
        depth += 1
        continue
      }
      if (this.consumeSymbol('}')) {
        depth -= 1
        continue
      }
      this.index += 1
    }
  }

  private skipUntilSymbol(symbol: string): void {
    while (!this.peekSymbol(symbol) && !this.peekSymbol('}') && this.index < this.tokens.length) {
      this.index += 1
    }
  }

  private expectIdentifier(value: string): void {
    const token = this.expect('identifier')
    if (token.value !== value) {
      throw new Error(`Expected "${value}".`)
    }
  }

  private expectSymbol(value: string): void {
    const token = this.expect('symbol')
    if (token.value !== value) {
      throw new Error(`Expected "${value}".`)
    }
  }

  private consumeSymbol(value: string): boolean {
    if (!this.peekSymbol(value)) {
      return false
    }
    this.index += 1
    return true
  }

  private peekSymbol(value: string): boolean {
    const token = this.tokens[this.index]
    return token?.type === 'symbol' && token.value === value
  }

  private peekIdentifier(value: string): boolean {
    const token = this.tokens[this.index]
    return token?.type === 'identifier' && token.value === value
  }

  private consumeIdentifier(value: string): boolean {
    if (!this.peekIdentifier(value)) {
      return false
    }
    this.index += 1
    return true
  }

  private peek(type: Token['type']): boolean {
    return this.tokens[this.index]?.type === type
  }

  private expect(type: Token['type']): Token {
    const token = this.tokens[this.index]
    if (!token || token.type !== type) {
      throw new Error(`Expected ${type}.`)
    }
    this.index += 1
    return token
  }
}

function scanTypeNames(tokens: Token[]): string[] {
  const names: string[] = []
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = tokens[index]
    const next = tokens[index + 1]
    if (token?.type === 'identifier' && (token.value === 'interface' || token.value === 'class') && next?.type === 'identifier') {
      names.push(next.value)
    }
  }
  return names
}

function isFieldModifier(value: string): boolean {
  return ['public', 'private', 'protected', 'readonly', 'declare', 'static', 'override'].includes(value)
}
