# Contributing to namera

Thanks for helping improve namera. Bug fixes, features, tests and documentation are all welcome.

## Prerequisites

- Node.js 26
- pnpm 12

The repository pins its Node.js version in `.node-version` and its package manager in
`package.json`.

## Setup

Fork and clone the repository, then install dependencies:

```sh
pnpm install
```

Install [Foundry](https://getfoundry.sh) 1.9 before `pnpm install`: the contracts package installs
its Soldeer dependencies during install. See [`contracts/README.md`](./contracts/README.md).

`pnpm install` installs the Git hooks (Lefthook) and patches TypeScript 7 and Oxlint with the
[Effect language service](https://github.com/Effect-TS/tsgo), so `tsc` and `oxlint` report Effect
diagnostics. In VS Code, install the recommended extensions (Oxc, Vitest and TypeScript Native
Preview); the workspace settings point them at the patched compiler and the configs in `.config/`.

## Repository structure

```text
contracts/      @namera-ai/contracts-sol: Solidity contracts (Foundry, private)
packages/sdk/   @namera-ai/sdk: Scoped, revocable permissions for agent wallets on ERC-7579 smart accounts.
packages/contracts/ @namera-ai/contracts: ABIs and deployment addresses of Namera's Smart Sessions contracts.
packages/       Publishable packages
apps/           Runnable applications (private)
tools/cli/      namera-dev: repository tooling (release checks)
.changeset/     Pending release notes
.config/        Lint, format, test, Turborepo and commit configuration
```

Keep changes within the package that owns the behavior.

## Development checks

Run the complete check before opening a pull request:

```sh
pnpm check
```

| Command               | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| `pnpm check`          | Format check, lint, typecheck, build and tests       |
| `pnpm format`         | Format the workspace with Oxfmt                      |
| `pnpm lint:fix`       | Apply Oxlint's automatic fixes                       |
| `pnpm test`           | Run every Vitest project once                        |
| `pnpm test:contracts` | Run the Foundry tests in `contracts/`                |
| `pnpm dev`            | Run every package's dev task                         |
| `pnpm pack:check`     | Check each publishable package with publint and attw |

The Git hooks format and lint staged files on commit, check the commit message, and run lint,
typecheck and tests before a push.

## Tests

Each package keeps its tests in `test/`, written with `@effect/vitest`. Tests import the package by
its name and resolve its sources through the `workspace-source` export condition, so no build is
needed. Register a new package's tests as a project in `.config/vitest.config.ts`.

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org) with an optional kebab-case scope:

```text
feat(api): add retries to the client
fix(web): keep the search query on reload
docs: explain the release workflow
```

Pull requests are squash-merged, so the PR title becomes the commit: it must follow the same format
(checked by the `PR title` workflow). Keep each pull request focused on one change and fill in the
template.

## Changesets

Add a changeset for every user-visible change to a published package:

```sh
pnpm changeset
```

Pick the packages and the bump (`patch` for fixes, `minor` for features, `major` for breaking
changes) and write one or two sentences for the changelog. Tests, docs, tooling and private packages
need no changeset.

## Releases

Maintainers release from `main` by dispatching the `Release` workflow:

1. With pending changesets, it opens (or updates) the `chore(release): version packages` PR.
2. Merging that PR and dispatching again packs the packages, verifies the tarballs
   (`pnpm release:check`: publint, attw and a consumer install), and publishes those exact tarballs
   to npm with provenance, then tags and creates GitHub releases.
3. Once npm serves the versions, dispatch `Release smoke` with the IDs from the release summary to
   compare the published packages with the verified tarballs.

The workflow defaults to a dry run, which versions and verifies inside the runner and publishes
nothing.

### npm trusted publisher setup

Releases publish with npm trusted publishing (OIDC), without an npm token. For each package, add a
trusted publisher on npmjs.com: GitHub Actions, this repository, workflow `release.yml`, no
environment.

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](./LICENSE).
