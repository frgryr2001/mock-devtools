# @mock-devtools/browser-runtime

Owns browser-side interception for `fetch` and `XMLHttpRequest`, request context parsing, delay application, local logs, and localStorage helpers.

Public exports include `createMockDevtoolsRuntime`, `readRequestContext`, `loadState`, `saveState`, and runtime/log/storage types.

Run tests:

```bash
pnpm --filter @mock-devtools/browser-runtime test
```

This package does not render controls or know about Vite, Next, or other framework adapters.
