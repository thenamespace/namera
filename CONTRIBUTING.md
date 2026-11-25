# Contributing to namera

Thanks for helping improve namera. Bug fixes, features, tests and documentation are all welcome.

## Prerequisites

- Node.js 26 (pinned in `.node-version`; packages support Node.js 22.19 and later)
- pnpm 12 (pinned in `package.json`)
- [Foundry](https://getfoundry.sh) 1.9, installed before `pnpm install`: the contracts package installs its Soldeer
  dependencies then, and the test devnet runs anvil. See [`contracts/README.md`](./contracts/README.md).

## Setup

```sh
pnpm install
```

`pnpm install` installs the Git hooks (lefthook) and patches TypeScript 7 with the
[Effect language service](https://github.com/Effect-TS/tsgo), so type checking reports Effect
diagnostics. In VS Code, install the recommended extensions (dprint, Oxc, Vitest and TypeScript
Native Preview).

## Repository structure

```text
contracts/          @namera-ai/contracts-sol: Solidity contracts (Foundry, private)
packages/contracts/ @namera-ai/contracts: ABIs and deployment addresses of Namera's Smart Sessions contracts
packages/sdk/       @namera-ai/sdk: session keys, policies and grants for agents on Kernel 3.3 smart accounts
packages/devnet/    @namera-ai/devnet (private): the local devnet tests run on (anvil, alto, Kernel, contracts)
packages/           Publishable packages
apps/               Runnable applications (private)
scripts/            Repository tooling: checks, code generation, contract deployments, releases, lint rules
scratchpad/         Ad hoc probes (ignored by git)
.changeset/         Pending release notes
```

Keep changes within the package that owns the behaviour.

## Checks

Run everything CI runs before opening a pull request:

```sh
pnpm check
```

| Command                   | What it does                                                             |
| ------------------------- | ------------------------------------------------------------------------ |
| `pnpm format`             | Format with dprint                                                       |
| `pnpm lint:fix`           | Apply oxlint's automatic fixes                                           |
| `pnpm typecheck`          | Type-check with the Effect language service                              |
| `pnpm test`               | Run the tests once (`pnpm test:watch` to watch)                          |
| `pnpm build`              | Build every package                                                      |
| `pnpm test:types`         | Run the type tests                                                       |
| `pnpm test:docs`          | Run the examples in the TSDoc                                            |
| `pnpm test:contracts`     | Run the Foundry tests in `contracts/`                                    |
| `pnpm docs:check`         | Check the TSDoc                                                          |
| `pnpm codegen`            | Regenerate barrels, exports maps, the version module and devnet bytecode |
| `pnpm api-snapshot`       | Rewrite the API reports (`packages/<name>/etc/`); review the diff        |
| `pnpm contracts:generate` | Regenerate `@namera-ai/contracts` from the build and deployment records  |
| `pnpm pack:check`         | Check the packed packages with publint and attw                          |

The Git hooks format and lint staged files on commit, check the commit message, and run lint, type
checking and tests before a push.

## Tests

Each package keeps its tests in `test/`, mirroring `src/`, written with `@effect/vitest`. Packages
export their source during development, so tests need no build. Tests that need a chain are named
`*.chain.test.ts` and run against `@namera-ai/devnet`. Type tests live in `typetest/` (`*.tst.ts`,
tstyche).

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org) with an optional kebab-case scope:

```text
feat(core): add retries to the client
fix(web): keep the search query on reload
docs: explain the release workflow
```

Pull requests are squash-merged, so the PR title becomes the commit and must follow the same format
(checked by the `PR title` workflow). Keep each pull request to one change and fill in the template.

## Changesets

Add a changeset for every change a consumer of a published package can observe:

```sh
pnpm changeset
```

Pick the packages and the bump (`patch` for fixes, `minor` for features, `major` for breaking
changes; before 1.0.0 breaking changes are `minor`) and write one sentence for the changelog. Tests,
docs, tooling and private packages need no changeset.

## Releases

Maintainers release from `main` by dispatching the `Release` workflow:

1. With pending changesets, it opens (or updates) the `chore(release): version packages` PR.
2. Merging that PR and dispatching again checks the repository, packs the packages, verifies the
   tarballs (`pnpm release:check`: publint, attw, a clean install that imports every entry point
   and runs every bin), and publishes those exact tarballs with npm provenance, then tags and
   creates GitHub releases.
3. Once npm serves the versions, dispatch `Release smoke` with the IDs from the release summary: it
   compares the published packages and their provenance with the verified tarballs.

The workflow defaults to a dry run, which versions and verifies inside the runner and publishes
nothing.

### First release of a package

`@namera-ai/sdk` already exists on npm (its v1 releases), so only a new package such as
`@namera-ai/contracts` needs these steps. npm trusted publishing (OIDC, no npm token) can only be configured for a package that exists:

1. Publish a placeholder once, by hand, under a separate tag so `latest` stays free:
   `npm publish --access public --tag bootstrap` from a folder containing only a `package.json`
   with the package's `name`, `"version": "0.0.0"`, `license` and `repository`.
2. On npmjs.com, add a trusted publisher to the package: GitHub Actions, this repository, workflow
   `release.yml`, no environment. Allow `npm publish`; leave `npm dist-tag` unchecked.
3. In the repository settings, allow GitHub Actions to create pull requests (Actions → General).

## License

By contributing, you agree that your contributions are licensed under the
[Apache License 2.0](./LICENSE).
