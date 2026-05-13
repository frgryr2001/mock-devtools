import { createRoot, type Root } from 'react-dom/client'
import { App, type AppProps } from './App'

export interface MockDevtoolsUiOptions {
  target?: HTMLElement
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  defaultOpen?: boolean
  storageKey?: string
  serviceWorkerUrl?: string
  schemaResolverUrl?: string
  onStateChange?: AppProps['onStateChange']
}

export interface MountedMockDevtoolsUi {
  unmount(): void
}

export function mountMockDevtoolsUi(options: MockDevtoolsUiOptions = {}): MountedMockDevtoolsUi {
  const host = options.target ?? document.body
  const container = document.createElement('div')
  host.append(container)
  const root: Root = createRoot(container)
  const appProps = {
    ...(options.defaultOpen === undefined ? {} : { defaultOpen: options.defaultOpen }),
    ...(options.position === undefined ? {} : { position: options.position }),
    ...(options.storageKey === undefined ? {} : { storageKey: options.storageKey }),
    ...(options.serviceWorkerUrl === undefined ? {} : { serviceWorkerUrl: options.serviceWorkerUrl }),
    ...(options.schemaResolverUrl === undefined ? {} : { schemaResolverUrl: options.schemaResolverUrl }),
    ...(options.onStateChange === undefined ? {} : { onStateChange: options.onStateChange }),
  }

  root.render(<App {...appProps} />)

  return {
    unmount() {
      root.unmount()
      container.remove()
    },
  }
}

export { App }
