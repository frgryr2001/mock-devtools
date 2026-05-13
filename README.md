# mock-devtools

Mock DevTools is a development panel for mocking REST APIs while you build a frontend. Use it when the UI is ready, but the backend is unfinished, flaky, or hard to run locally.

## Features

- Mock `fetch` and `XMLHttpRequest` calls from inside your app.
- Create routes by method and URL pattern, including params like `/api/users/:id`.
- Match requests by headers and JSON request body.
- Return object, array, paginated, empty, or `null` responses.
- Paste a TypeScript model and generate fake response data from it.
- Mock calls to a configured backend origin during local development.
- Edit, duplicate, enable, disable, and delete routes from the panel.
- Inspect mocked and pass-through requests in the Logs tab.
- Use either the Vite plugin or an unpacked Chrome extension.

## Installation

For a Vite app:

```sh
pnpm add -D @mock-devtools/vite
```

This repository is still a workspace package while it is being prepared for release. The npm package names are reserved in the package manifests, but publishing requires removing `private: true` and choosing a real version.

## Usage

Add the Vite plugin to your app. In most cases you only want it during development:

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

Start your app and open the `Mock` button in the corner. Add a route, turn mocking on, then use your app normally.

## Chrome Extension

You can also use Mock DevTools as an unpacked local Chrome extension.

Build the extension:

```sh
pnpm --filter @mock-devtools/chrome-extension build
```

Load it in Chrome:

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select `packages/chrome-extension/dist`.
5. Open the app you want to test.
6. Click the extension icon and choose `Enable this site`.

The extension injects the same route studio UI into the current site. This mode is intended for local development and internal sharing.

## Create A GET Mock

Use this when the frontend calls a detail endpoint like `GET /api/users/1`.

1. Open the `Mock` panel.
2. Set `Method` to `GET`.
3. Set `URL pattern` to `/api/users/:id`.
4. Keep `Status` as `200`.
5. Click `Add route`.
6. Click `Mocking off` to turn mocking on.
7. Trigger the request from your app.

The route pattern `/api/users/:id` matches `/api/users/1`, `/api/users/abc`, and other single user IDs.

## Match POST Bodies

For `POST`, `PUT`, and `PATCH`, Mock DevTools can match JSON request bodies.

Example route:

- Method: `POST`
- URL pattern: `/api/users`
- Body match operator: `contains`
- Body JSON:

```json
{
  "name": "Ada"
}
```

With `contains`, this request matches:

```json
{
  "name": "Ada",
  "role": "admin"
}
```

With `equals`, the incoming body must match the configured JSON exactly.

## Generate Responses From TypeScript

Use `Custom Response` when you want fake data from a TypeScript model.

```ts
interface CompanyModel {
  fullName: string
  shortName: string
  logo: string
  avatar: string
  uenNumber: string
  websiteAddress: string
  attachments: {
    url: string
    name: string
  }[]
}
```

Choose a response shape:

- `object` returns one generated object.
- `array` returns a generated list. `Item count` controls the length.
- `paginated` returns `{ data, meta }`.
- `empty` returns no body.
- `null` returns `null`.

Click `Generate preview` to see the JSON. Click `Use as manual response` when the preview should become the route response.

## Backend Origin Override

Use `Settings` -> `Backend origin override` when your app already calls a backend host and you want relative mock routes to match only that origin.

Example setting:

```text
https://api.example.test
```

Now a relative route pattern like this:

```text
/api/users/:id
```

can mock a request to:

```text
https://api.example.test/api/users/1
```

Leave the setting empty when you want relative route patterns to match the current request URL without origin filtering.

## Logs

The Logs tab shows what Mock DevTools saw.

Use it to check:

- whether a request was mocked or passed through
- which method and URL were used
- which status was returned
- whether your route matcher is too strict

Enable pass-through logging in Settings when you also want to see requests that did not match a route.

## Release

See [docs/release.md](./docs/release.md) for the full release checklist.

The short version:

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm build:extension-release
```

Attach this file to a GitHub Release:

```text
release/mock-devtools-chrome-extension.zip
```

Publish npm packages in dependency order:

```text
@mock-devtools/core
@mock-devtools/browser-runtime
@mock-devtools/ui
@mock-devtools/vite
```

Keep `@mock-devtools/chrome-extension` private unless you later package it specifically for the Chrome Web Store.

## Current Limits

- Mock DevTools focuses on one response per route.
- It is not a full Postman replacement.
- TypeScript parsing is practical, not a full TypeScript compiler.
- Unresolved imports fall back gracefully, but missing imported fields cannot be generated.
- The unpacked Chrome extension is for local development and internal sharing.

## Related Packages

- [`@mock-devtools/core`](./packages/core/README.md): route types, matching, validation, schema parsing, fake data, and response building.
- [`@mock-devtools/browser-runtime`](./packages/browser-runtime/README.md): browser interception, request parsing, logs, and local storage helpers.
- [`@mock-devtools/ui`](./packages/ui/README.md): the React panel, route editor, preview generation, logs, and settings.
- [`@mock-devtools/vite`](./packages/vite/README.md): Vite integration and dev-only injection.

## Related Work

- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Mock Service Worker](https://mswjs.io/)
- [Vite plugins](https://vite.dev/guide/api-plugin.html)
- [Faker](https://fakerjs.dev/)

## License

No license file is currently included in this repository.
