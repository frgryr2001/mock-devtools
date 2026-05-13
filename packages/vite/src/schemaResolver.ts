import { readFile } from 'node:fs/promises'
import { extname, isAbsolute, join, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { parseInterfaceSchema, type ParsedSchema } from '@mock-devtools/core'

export const schemaResolverEndpoint = '/@mock-devtools/schema'

export interface ResolveProjectSchemaInput {
  root: string
  source: string
  schemaName?: string | undefined
  resolveId?(specifier: string, importer?: string): string | undefined | Promise<string | undefined>
}

export interface ResolveProjectSchemaResult {
  schema: ParsedSchema
  unresolvedImports: UnresolvedImport[]
}

export interface UnresolvedImport {
  name: string
  specifier: string
}

export interface SchemaResolverRequest {
  source?: string
  schemaName?: string
}

export interface CreateSchemaResolverHandlerOptions {
  root: string
  resolveId?(specifier: string, importer?: string): string | undefined | Promise<string | undefined>
}

interface ImportedType {
  name: string
  specifier: string
}

const readableExtensions = ['', '.ts', '.tsx', '.d.ts']

export async function resolveProjectSchema(input: ResolveProjectSchemaInput): Promise<ResolveProjectSchemaResult> {
  const imports = findTypeImports(input.source)
  const resolvedSources: string[] = []
  const unresolvedImports: UnresolvedImport[] = []

  for (const importedType of imports) {
    const importedSource = await readImportedSource(input, importedType)
    if (!importedSource) {
      unresolvedImports.push({ name: importedType.name, specifier: importedType.specifier })
      continue
    }
    resolvedSources.push(importedSource)
  }

  return {
    schema: parseInterfaceSchema([...resolvedSources, input.source].join('\n'), { schemaName: input.schemaName }),
    unresolvedImports,
  }
}

export function createSchemaResolverHandler(options: CreateSchemaResolverHandlerOptions) {
  return async function handleSchemaResolverRequest(request: IncomingMessage, response: ServerResponse): Promise<boolean> {
    const pathname = request.url?.split('?')[0]
    if (pathname !== schemaResolverEndpoint) {
      return false
    }

    if (request.method !== 'POST') {
      writeJson(response, 405, { error: 'Schema resolver only accepts POST requests.' })
      return true
    }

    try {
      const body = JSON.parse(await readRequestBody(request)) as SchemaResolverRequest
      const result = await resolveProjectSchema({
        root: options.root,
        source: body.source ?? '',
        schemaName: body.schemaName,
        ...(options.resolveId ? { resolveId: options.resolveId } : {}),
      })
      writeJson(response, 200, result)
    } catch (error) {
      writeJson(response, 400, { error: error instanceof Error ? error.message : 'Schema could not be resolved.' })
    }

    return true
  }
}

async function readImportedSource(input: ResolveProjectSchemaInput, importedType: ImportedType): Promise<string | undefined> {
  const resolvedId = await input.resolveId?.(importedType.specifier)
  const candidates = resolvedId ? [resolvedId] : [resolve(input.root, importedType.specifier)]

  for (const candidate of candidates.flatMap(expandCandidatePaths)) {
    try {
      return await readFile(candidate, 'utf8')
    } catch {
      continue
    }
  }

  return undefined
}

function expandCandidatePaths(candidate: string): string[] {
  const absoluteCandidate = isAbsolute(candidate) ? candidate : resolve(candidate)
  if (extname(absoluteCandidate)) {
    return [absoluteCandidate]
  }

  return [
    ...readableExtensions.map((extension) => `${absoluteCandidate}${extension}`),
    ...readableExtensions.map((extension) => join(absoluteCandidate, `index${extension}`)),
  ]
}

function findTypeImports(source: string): ImportedType[] {
  const imports: ImportedType[] = []
  const importPattern = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']([^"']+)["']/g

  for (const match of source.matchAll(importPattern)) {
    const names = match[1] ?? ''
    const specifier = match[2]
    if (!specifier) {
      continue
    }

    for (const name of names.split(',')) {
      const importedName = name.trim().split(/\s+as\s+/)[0]?.trim()
      if (importedName) {
        imports.push({ name: importedName, specifier })
      }
    }
  }

  return imports
}

async function readRequestBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json')
  response.end(JSON.stringify(body))
}
