import type { Plugin, ResolvedConfig } from 'vite'
import { createSchemaResolverHandler, schemaResolverEndpoint } from './schemaResolver'
import {
  createVirtualClientModule,
  createVirtualServiceWorkerModule,
  virtualClientId,
  virtualServiceWorkerId,
} from './virtualModule'

export interface MockDevtoolsViteOptions {
  enabled?: boolean
  ui?: {
    enabled?: boolean
    position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    defaultOpen?: boolean
  }
}

export function mockDevtools(options: MockDevtoolsViteOptions = {}): Plugin {
  let config: Pick<ResolvedConfig, 'command' | 'root'> = { command: 'serve', root: process.cwd() }

  function shouldInject(): boolean {
    if (options.ui?.enabled === false) {
      return false
    }
    if (options.enabled === false) {
      return false
    }
    if (options.enabled === true) {
      return true
    }
    return config.command === 'serve'
  }

  return {
    name: 'mock-devtools',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    configureServer(server) {
      const handleSchemaRequest = createSchemaResolverHandler({
        root: config.root,
        resolveId: async (specifier) => {
          const resolved = await server.pluginContainer.resolveId(specifier)
          return typeof resolved?.id === 'string' ? resolved.id : undefined
        },
      })

      server.middlewares.use((request, response, next) => {
        void handleSchemaRequest(request, response).then((handled) => {
          if (!handled) {
            next()
          }
        })
      })
    },
    resolveId(id) {
      return id === virtualClientId || id === virtualServiceWorkerId ? id : undefined
    },
    load(id) {
      if (id === virtualClientId) {
        return createVirtualClientModule(options)
      }
      if (id === virtualServiceWorkerId) {
        return createVirtualServiceWorkerModule()
      }
      return undefined
    },
    transformIndexHtml(html) {
      if (!shouldInject()) {
        return html
      }

      const script = `<script type="module" src="${virtualClientId}"></script>`
      return html.includes('</body>') ? html.replace('</body>', `${script}</body>`) : `${html}${script}`
    },
  }
}

export { virtualClientId }
export { createSchemaResolverHandler, resolveProjectSchema, schemaResolverEndpoint } from './schemaResolver'
