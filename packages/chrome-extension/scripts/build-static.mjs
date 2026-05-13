import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(packageRoot, 'src')
const distRoot = resolve(packageRoot, 'dist')

const manifest = {
  manifest_version: 3,
  name: 'Mock DevTools',
  description: 'Enable Mock DevTools on the current site and inject the route studio into the page.',
  version: '0.0.0',
  action: {
    default_title: 'Mock DevTools',
    default_popup: 'popup.html',
  },
  permissions: ['activeTab', 'storage'],
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['content.js'],
      run_at: 'document_start',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['main-world.js', 'ui.css'],
      matches: ['http://*/*', 'https://*/*'],
    },
  ],
}

await mkdir(distRoot, { recursive: true })
await copyFile(resolve(distRoot, 'content.iife.js'), resolve(distRoot, 'content.js'))
await copyFile(resolve(distRoot, 'popup.iife.js'), resolve(distRoot, 'popup.js'))
await copyFile(resolve(distRoot, 'main-world.iife.js'), resolve(distRoot, 'main-world.js'))
await copyFile(resolve(distRoot, 'content.css'), resolve(distRoot, 'ui.css'))
await copyFile(resolve(sourceRoot, 'popup.html'), resolve(distRoot, 'popup.html'))
await writeFile(resolve(distRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
