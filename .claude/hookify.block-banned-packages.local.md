---
name: block-banned-packages
enabled: true
event: bash
pattern: \bbun\s+add\s+.*(express|fastify|next|prisma|mongodb|mongoose|eslint|prettier|redux|mobx|recoil|jotai|nx|lerna|create-react-app)\b
action: block
---

**Banned package detected.** This project has explicit technology constraints:

| Banned | Use Instead |
|--------|-------------|
| express, fastify | **Hono** (on Bun.serve()) |
| next, create-react-app | **Vite + React 19** |
| prisma | **Drizzle ORM** |
| redis *(direct)*, bull *(v3)* | **ioredis + BullMQ** (approved for async jobs) |
| mongodb, mongoose | **PostgreSQL + Drizzle** |
| eslint, prettier | **Biome** |
| redux, mobx, recoil, jotai | **Zustand** (UI state) + **TanStack Query** (server state) |
| nx, lerna | **Turborepo + Bun workspaces** |

See `.kiro/steering/tech.md` for the full constraints.
