# Namera

Namera is a programmable session key layer for smart wallets. It enables wallets to delegate scoped permissions through session keys with programmable policies.


## Core Stack
- **Runtime & Package Manager:** Bun
- **Monorepo Tooling:** Turborepo
- **Core Paradigm:** Functional Programming using Effect v3 `effect`

## Monorepo Architecture & Responsibilities

### `apps/` (Deployables)

- `docs/`: Developer documentation. Built with Fumadocs + Tanstack Start.
- `cli`: CLI for managing accounts, sessions, wallets and running local MCP server. 

### `packages/` (Shared Internal Libraries + Published Packages)
- `core/`: Core business logic and utilities.
- `config/`: Centralized configurations (`tsconfig`, `Biome`, `Vitest`, `tsdown`).
- `ui/`: Shared UI components.
- `package-starter/`: Scaffold for generating new packages.


---

## Strict Effect Guidelines
- **Workflow:** Exclusively use `Effect.gen` for orchestrating program logic. Avoid chaining `flatMap` or `map` unless the operation is trivial (1-2 steps).
- **Validation Boundaries:** Always use `@effect/schema` at the edges of the system (API payloads, database reads, environment variables). Do not rely on generic TypeScript assertions.
- **Error Handling:** Never use `throw new Error()`. Yield errors into the Effect type signature. Model expected failures as specific tagged classes.
- **Dependency Management:** Decouple logic. Build dependencies using `Context` and wire them via `Layer`s at the application entry points (`apps/*`).
- **Database:** All database interactions must use the Drizzle ORM + Effect Adapter. Yield database operations within the Effect context.

## Monorepo & Tooling Rules
- **Package Manager:** Use `bun` exclusively.
- **Workspace Targeting:** When installing dependencies for a specific package, use `bun add <pkg> --filter <workspace>`.
- **Formatting:** Do not meticulously format code manually. Run `bun run lint` to format via Biome after edits.

---

## Core Principles & Coding Style
- **Zero Tolerance for Errors:** All type checks, linting, and tests must pass. Do not leave placeholder types (`any`) or bypass strict checks.
- **Clarity > Cleverness:** Choose clear, maintainable solutions
- **Conciseness:** Keep code and any wording concise and to the point. Sacrifice grammar for the sake of concision.
- **Minimal Comments:** Avoid comments unless absolutely required to explain unusual or complex logic.
- **Pattern Matching:** Always analyze existing files in the repository to match established patterns before proposing new structures.

## Mandatory Actions
1. **Post-Edit:** Always run `bun run lint` after modifying any file.
2. **Post-Install:** Always run `bun install` at the root if modifying `package.json`.****