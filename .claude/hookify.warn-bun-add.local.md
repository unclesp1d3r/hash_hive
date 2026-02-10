---
name: warn-bun-add
enabled: true
event: bash
pattern: \bbun\s+(add|remove|install)\b
action: warn
---

**Check for running tests before modifying packages.**

Running `bun add` or `bun remove` while `bun test` is active corrupts `node_modules` mid-flight, causing ENOENT errors and broken module resolution.

Before proceeding, verify no test processes are running.
