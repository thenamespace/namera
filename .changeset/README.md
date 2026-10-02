# Releases

Only `api`, `protocol`, `sdk`, and `cli` publish to npm. Changesets keeps them in
one fixed version group. Utilities and telemetry stay private.

All four packages are released together, starting with 1.0.0.

For later changes, run `pnpm changeset` and commit the resulting release note.

## GitHub release flow

1. Enable Actions to create pull requests. Dispatch **CI** against the branch
   you want to verify before merging or releasing.
2. Configure npm trusted publishing for each package for repository
   `thenamespace/namera-core`, workflow `release.yml`. Existing SDK/CLI trusted
   publisher settings must point to this repository, not the old repository.
   New package names need initial publication/ownership setup before trusted
   publishing can be configured; do that from an authorized maintainer environment.
3. Dispatch **Release**. With pending changesets it creates a version/changelog PR.
4. Review and merge that PR. Dispatch **CI** on the resulting main commit.
5. After CI passes, dispatch **Release** again to publish and tag that commit.

The shared setup action pins Node/pnpm. CI runs checks, tests, tarball validation,
and a separate disposable PostgreSQL integration lane. No production credentials
are needed for CI. Release uses npm OIDC and provenance, not a committed token.
Release does not run lint, type checks, tests, or tarball smoke checks. It builds
only the public packages and their dependencies before publishing. There is no
automatic CI gate: the operator must verify CI passed for the current main commit.
CI dashboard builds use `https://api.namera.ai` unless the repository variable
`VITE_API_URL` overrides it; no local `.env` file is required.

## Local commands

- `pnpm changeset status`: preview the release plan without changing versions.
- `pnpm version-packages`: apply changesets and update the lockfile; review and
  commit the version/changelog changes before publishing.
- `pnpm pack:check`: build and validate public tarballs, then install them through
  an isolated local registry using npm. Checks CLI startup/login/MCP help and an
  SDK request without workspace resolution or production credentials. Run this
  after other builds, not concurrently with them.
  The candidate registry advertises bundled npm shrinkwraps, matching npm's
  metadata. The clean-install check verifies the installed Effect runtime and
  Node adapter versions agree before testing CLI startup.
- `pnpm cli:lock`: regenerate the CLI's published npm shrinkwrap after changing
  runtime dependencies. Review and commit it with the dependency update.
  `version-packages` and CLI prepack synchronize sibling release versions without
  re-resolving third-party dependencies. Libraries do not publish shrinkwraps.
- `pnpm release`: build public packages and publish already-versioned, unpublished
  versions. **This really publishes** and needs npm authority. Versioning runs
  separately through `pnpm version-packages`, before the release PR is merged.

Both **CI** and **Release** intentionally require manual dispatch. Neither runs
on a pull request or an ordinary push.
