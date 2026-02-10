---
name: block-npm-yarn-pnpm
enabled: true
event: bash
pattern: \b(npm|yarn|pnpm)\s+(install|i|add|remove|run|ci|test|start|exec|init|create|publish|pack)\b
action: block
---

**This project uses Bun exclusively as its runtime and package manager.**

Do not use npm, yarn, or pnpm. Replace with the Bun equivalent:

- `npm install` -> `bun install`
- `npm add <pkg>` -> `bun add <pkg>`
- `npm run <script>` -> `bun run <script>` or `bun <script>`
- `npm test` -> `bun test`
- `npx <cmd>` -> `bunx <cmd>`

See `.kiro/steering/tech.md` and `AGENTS.md`.
