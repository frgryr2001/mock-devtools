import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = process.cwd()
const extensionDist = resolve(root, 'packages/chrome-extension/dist')
const releaseRoot = resolve(root, 'release/mock-devtools-chrome-extension')
const archivePath = resolve(root, 'release/mock-devtools-chrome-extension.zip')

await rm(releaseRoot, { recursive: true, force: true })
await rm(archivePath, { force: true })
await mkdir(releaseRoot, { recursive: true })
await cp(extensionDist, resolve(releaseRoot, 'extension'), { recursive: true })
await writeFile(
  resolve(releaseRoot, 'README.md'),
  `# Mock DevTools Chrome Extension

This is the unpacked Chrome extension build.

## Install

1. Open \`chrome://extensions\`.
2. Enable \`Developer mode\`.
3. Click \`Load unpacked\`.
4. Select the \`extension\` folder next to this README.
5. Open your app, click the Mock DevTools extension icon, and choose \`Enable this site\`.

This build is intended for local development and internal sharing.
`,
)

await createZip(releaseRoot, archivePath)
console.log(`Extension release prepared at ${releaseRoot}`)
console.log(`Archive prepared at ${archivePath}`)

async function createZip(sourceDir, targetFile) {
  const zip = spawn('zip', ['-qr', targetFile, 'mock-devtools-chrome-extension'], {
    cwd: resolve(sourceDir, '..'),
    stdio: ['ignore', 'ignore', 'inherit'],
  })
  const exitCode = await new Promise((resolveExit) => zip.on('close', resolveExit))
  if (exitCode !== 0) {
    throw new Error(`zip exited with code ${exitCode}`)
  }
}
