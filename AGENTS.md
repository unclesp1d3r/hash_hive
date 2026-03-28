# Agent Context

This file provides AI coding assistants with project context. All substantive documentation lives in the files linked below.

## Project Documentation

- **[Architecture & Design](./ARCHITECTURE.md)** -- system overview, tech stack, schema flow, backend/frontend architecture, API surfaces, data model, documentation hierarchy
- **[Contributing Standards](./CONTRIBUTING.md)** -- code style, naming conventions, git workflow, PR process, issue tracking
- **[Development Setup](./docs/development.md)** -- environment, commands, infrastructure services, environment variables
- **[Testing](./docs/testing.md)** -- test strategy, bun:test patterns, mock patterns, frontend test utilities
- **[Known Gotchas](./GOTCHAS.md)** -- hard-won lessons by domain (TypeScript strict mode, Hono, Drizzle, BetterAuth, bun:test, frontend JSX)

## Agent-Specific Notes

- `.kiro/steering/` and `.kiro/specs/` are **authoritative** -- align structural changes with those documents rather than inferring architecture solely from current code. When code conflicts with these documents, the documents win.
- `.kiro/steering/tech.md` contains explicit constraints on what NOT to introduce. Respect these constraints.
- Prefer mermaid diagrams for architectural or sequence diagrams in documentation.
- Agents (hashcat workers) are the primary API consumer. Never break the agent API to improve the dashboard experience.

## Agent Rules <!-- tessl-managed -->

@.tessl/RULES.md follow the [instructions](.tessl/RULES.md)
