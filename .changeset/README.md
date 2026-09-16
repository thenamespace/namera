# Releases

Only `api`, `protocol`, `sdk`, and `cli` publish to npm. Changesets keeps them in
one fixed version group. Utilities and telemetry stay private.

The baseline reflects npm: SDK `0.1.1`, CLI `0.1.5`, and the unpublished API and
protocol `0.0.0`. The pending major changeset moves all four to **1.0.0**, not beta.
Do not remove it or publish the baseline versions.

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
4. Review and merge that PR. Dispatch **Release** again to publish and tag.

The shared setup action pins Node/pnpm. CI runs checks, tests, tarball validation,
and a separate disposable PostgreSQL integration lane. No production credentials
are needed for CI. Release uses npm OIDC and provenance, not a committed token.
CI and Release dashboard builds use `https://api.namera.ai` unless the repository
variable `VITE_API_URL` overrides it; no local `.env` file is required.

## Local commands

- `pnpm changeset status`: preview the release plan without changing versions.
- `pnpm version-packages`: apply changesets and update the lockfile; review and
  commit the version/changelog changes before publishing.
- `pnpm pack:check`: build and validate public tarballs without publishing.
- `pnpm release`: apply any pending version changes, validate tarballs, and
  publish unpublished versions. **This really publishes** and needs npm authority.

Both **CI** and **Release** intentionally require manual dispatch. Neither runs
on a pull request or an ordinary push.
