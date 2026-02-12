---
name: block-wrong-test-runners
enabled: true
event: bash
pattern: \b(jest|vitest)\b
action: block
---

**This project uses `bun:test` for all tests.**

Do not use Jest or Vitest. Replace with:

- `jest` -> `bun test`
- `vitest` -> `bun test`
- `npx jest` -> `bun test`

Test files use `import { describe, expect, it } from 'bun:test'`.

See `AGENTS.md` and `.kiro/steering/tech.md`.
