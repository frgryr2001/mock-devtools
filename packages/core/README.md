# @mock-devtools/core

Owns framework-agnostic mock behavior: route config types, route matching, validation, schema parsing, fake data generation, and response building.

Public exports include `matchRoute`, `validateRoute`, `parseInterfaceSchema`, `generateFakeData`, `buildMockResponse`, and shared route/schema types.

Run tests:

```bash
pnpm --filter @mock-devtools/core test
```

This package does not patch browser APIs, render UI, or integrate with framework adapters.
