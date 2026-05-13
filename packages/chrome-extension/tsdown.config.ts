import { defineConfig } from 'tsdown'

const browserBundle = {
  format: ['iife'] as const,
  dts: false,
  platform: 'browser' as const,
  noExternal: [/^@mock-devtools\//, /^react(\/.*)?$/, /^react-dom(\/.*)?$/],
}

export default defineConfig([
  {
    ...browserBundle,
    entry: { content: 'src/content.ts' },
    clean: true,
  },
  {
    ...browserBundle,
    entry: { popup: 'src/popup.ts' },
    clean: false,
  },
  {
    ...browserBundle,
    entry: { 'main-world': 'src/mainWorld.ts' },
    clean: false,
  },
])
