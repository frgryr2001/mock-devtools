# Release Guide

This guide covers the current release shape for Mock DevTools:

- npm packages for app integration
- a GitHub Release asset for the unpacked Chrome extension

The proxy package is intentionally not part of the main release flow yet.

## Release Artifacts

| Artifact | Target | Notes |
| --- | --- | --- |
| `@mock-devtools/core` | npm | Shared route matching, schema parsing, fake data, and response building. |
| `@mock-devtools/browser-runtime` | npm | Browser runtime used by the UI. |
| `@mock-devtools/ui` | npm | React panel used by the Vite plugin and extension build. |
| `@mock-devtools/vite` | npm | Public Vite adapter users install in apps. |
| `mock-devtools-chrome-extension.zip` | GitHub Release | Unpacked Chrome extension bundle for local/internal sharing. |

Keep `@mock-devtools/chrome-extension` private unless you later ship through the Chrome Web Store.

## Preflight

Run from the repo root:

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

If Playwright fails with a localhost bind error, rerun the same command with local server permission in your agent environment. The example app needs to bind `127.0.0.1:5173`.

## Build The Chrome Extension Release

Run:

```sh
pnpm build:extension-release
```

This produces:

```text
release/mock-devtools-chrome-extension
release/mock-devtools-chrome-extension.zip
```

Check the zip contents:

```sh
unzip -l release/mock-devtools-chrome-extension.zip
```

The archive must include:

```text
mock-devtools-chrome-extension/README.md
mock-devtools-chrome-extension/extension/manifest.json
mock-devtools-chrome-extension/extension/content.js
mock-devtools-chrome-extension/extension/main-world.js
mock-devtools-chrome-extension/extension/popup.html
mock-devtools-chrome-extension/extension/popup.js
mock-devtools-chrome-extension/extension/ui.css
```

## Publish The GitHub Release

1. Create a git tag, for example:

```sh
git tag v0.1.0
git push origin v0.1.0
```

2. Create a GitHub Release for the tag.
3. Attach:

```text
release/mock-devtools-chrome-extension.zip
```

4. Release notes should include:

```md
## Install Chrome Extension

1. Download `mock-devtools-chrome-extension.zip`.
2. Extract the zip.
3. Open `chrome://extensions`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the extracted `extension` folder.
7. Open your app, click the Mock DevTools extension icon, and choose Enable this site.
```

## Prepare npm Packages

The package manifests currently use `private: true` and `workspace:*` dependency ranges. Before npm publish:

1. Pick a version, for example `0.1.0`.
2. Remove `private: true` from packages that should be published.
3. Set the same version in:

```text
packages/core/package.json
packages/browser-runtime/package.json
packages/ui/package.json
packages/vite/package.json
```

4. Replace workspace dependency ranges with the chosen version:

```json
"@mock-devtools/core": "^0.1.0"
```

5. Keep these packages private for now:

```text
packages/chrome-extension
packages/proxy
```

## npm Publish Order

Publish dependencies first:

```sh
pnpm --filter @mock-devtools/core publish --access public
pnpm --filter @mock-devtools/browser-runtime publish --access public
pnpm --filter @mock-devtools/ui publish --access public
pnpm --filter @mock-devtools/vite publish --access public
```

Use `npm pack --dry-run` before publishing each package if you want to inspect included files:

```sh
pnpm --filter @mock-devtools/vite pack --dry-run
```

## Post-Publish Smoke Test

Create or open a separate Vite app and install the published adapter:

```sh
pnpm add -D @mock-devtools/vite
```

Add the plugin:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mockDevtools } from '@mock-devtools/vite'

export default defineConfig({
  plugins: [
    react(),
    mockDevtools({
      enabled: process.env.NODE_ENV === 'development',
      ui: {
        enabled: true,
        position: 'bottom-right',
        defaultOpen: false,
      },
    }),
  ],
})
```

Start the app and verify:

- the `Mock` trigger appears
- a `GET /api/users/:id` route can be created
- `Mocking on` returns the configured response
- the Logs tab records the mocked request

## Rollback

For npm, deprecate the broken version and publish a patch:

```sh
npm deprecate @mock-devtools/vite@0.1.0 "Use 0.1.1 instead."
```

For GitHub Releases, mark the bad release as pre-release or delete the attached extension zip and upload a corrected patch artifact.
