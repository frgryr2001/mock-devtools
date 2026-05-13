# @mock-devtools/vite

Owns Vite integration for injecting the Mock DevTools browser client during development.

Public exports include `mockDevtools`, `virtualClientId`, and Vite option types.

Run tests:

```bash
pnpm --filter @mock-devtools/vite test
```

This package does not implement route matching, browser interception, or React UI internals.
