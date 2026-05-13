# @mock-devtools/ui

Owns the embedded React trigger and panel UI for route editing, schema parsing, preview generation, logs, and settings.

Public exports include `mountMockDevtoolsUi`, `App`, and mount option types.

Run tests:

```bash
pnpm --filter @mock-devtools/ui test
```

This package does not inject itself into a framework app; adapters mount it.
