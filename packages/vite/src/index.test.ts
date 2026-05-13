import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mockDevtools } from './index'
import { resolveProjectSchema } from './schemaResolver'

describe('mockDevtools', () => {
  it('injects a module script when explicitly enabled', () => {
    const plugin = mockDevtools({ enabled: true })

    expect(transformHtml(plugin, '<html><body><main></main></body></html>')).toContain(
      '<script type="module" src="/@mock-devtools/client"></script>',
    )
  })

  it('returns HTML unchanged when disabled', () => {
    const plugin = mockDevtools({ enabled: false })
    const html = '<html><body><main></main></body></html>'

    expect(transformHtml(plugin, html)).toBe(html)
  })

  it('does not inject in production by default', () => {
    const plugin = mockDevtools()
    const configResolved = plugin.configResolved as ((config: { command: 'build' }) => void) | undefined
    configResolved?.({ command: 'build' })
    const html = '<html><body><main></main></body></html>'

    expect(transformHtml(plugin, html)).toBe(html)
  })

  it('serializes adapter options into the virtual module', () => {
    const plugin = mockDevtools({ enabled: true, ui: { position: 'top-left', defaultOpen: true } })
    const source = loadVirtualModule(plugin)

    expect(source).toContain('"position":"top-left"')
    expect(source).toContain('"defaultOpen":true')
    expect(source).toContain('"serviceWorkerUrl":"/mock-devtools-sw.js"')
    expect(source).toContain('"schemaResolverUrl":"/@mock-devtools/schema"')
  })

  it('serves the mock service worker virtual module', () => {
    const plugin = mockDevtools({ enabled: true })
    const resolveId = plugin.resolveId as ((id: string) => string | undefined) | undefined
    const load = plugin.load as ((id: string) => string | undefined) | undefined
    const id = resolveId?.('/mock-devtools-sw.js')
    const source = load?.(typeof id === 'string' ? id : '/mock-devtools-sw.js')

    expect(source).toContain('self.addEventListener')
    expect(source).toContain('fetch')
  })

  it('resolves an imported base class before parsing the selected model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mock-devtools-schema-'))
    await writeFile(
      join(root, 'user360.ts'),
      `
        export class User360Model {
          id: string;
          email: string;
        }
      `,
    )
    const result = await resolveProjectSchema({
      root,
      source: `
        import { User360Model } from "./user360";

        export class PartnerModel extends User360Model {
          companyName: string;
        }
      `,
      schemaName: 'PartnerModel',
      resolveId: (specifier) => (specifier === './user360' ? join(root, 'user360.ts') : undefined),
    })

    expect(result.schema.fields).toEqual([
      { name: 'id', optional: false, kind: 'string' },
      { name: 'email', optional: false, kind: 'string' },
      { name: 'companyName', optional: false, kind: 'string' },
    ])
    expect(result.unresolvedImports).toEqual([])
  })

  it('keeps local fields and reports unresolved imported types', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mock-devtools-schema-'))
    const result = await resolveProjectSchema({
      root,
      source: `
        import { User360Model } from "@/models/User360Model";

        export class PartnerModel extends User360Model {
          companyName: string;
        }
      `,
      schemaName: 'PartnerModel',
      resolveId: () => undefined,
    })

    expect(result.schema.fields).toEqual([{ name: 'companyName', optional: false, kind: 'string' }])
    expect(result.unresolvedImports).toEqual([{ name: 'User360Model', specifier: '@/models/User360Model' }])
  })
})

function transformHtml(plugin: ReturnType<typeof mockDevtools>, html: string): string {
  const hook = plugin.transformIndexHtml as ((html: string, context: unknown) => string) | undefined
  if (typeof hook !== 'function') {
    throw new Error('transformIndexHtml hook is not a function.')
  }

  return hook(html, {})
}

function loadVirtualModule(plugin: ReturnType<typeof mockDevtools>): string {
  const resolveId = plugin.resolveId as ((id: string) => string | undefined) | undefined
  const load = plugin.load as ((id: string) => string | undefined) | undefined
  const id = resolveId?.('/@mock-devtools/client')
  const resolvedId = typeof id === 'string' ? id : '/@mock-devtools/client'
  const loaded = load?.(resolvedId)

  if (typeof loaded !== 'string') {
    throw new Error('Virtual module did not load.')
  }

  return loaded
}
