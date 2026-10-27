# Delivery and releases

Deployment and publication are explicit GitHub Actions workflows. A successful
build verifies code and packaging, not the configuration of a running environment.

## Application delivery

[Deploy workflows](../../.github/workflows) select an app and call the shared
build-and-push workflow. Docker build contexts are the repository root. Images
are pushed through the configured GCP identity and dispatched to the infrastructure
repository; these workflows do not provision databases, ingress, or DNS.

| App          | Runtime                          | Configuration                              |
| ------------ | -------------------------------- | ------------------------------------------ |
| Server       | Node.js HTTP process and workers | Runtime secrets and provider configuration |
| Dashboard    | nginx static SPA                 | Public build-time API origin               |
| Admin portal | nginx static SPA                 | Public build-time API origin               |
| Website      | Nitro Node server                | Public site/API origins at build time      |

Do not bake server secrets into image build arguments. Browser `VITE_*` values
are public and require a rebuild when changed. Configure exact browser origins,
HTTPS cookie policy, and WebAuthn relying-party settings together. Static hosts
must preserve generated CSP and other response headers.

Database startup uses the package migrator; application processes must be able
to finish migrations before serving. Backups, restore procedures, TLS termination,
and external provider availability are deployment responsibilities, not guarantees
made by the source tree.

## npm release boundary

`api`, `protocol`, `sdk`, `cli` and `templates` form one fixed Changesets group.
All five public packages use the same version and release together. Workspace
dependencies become exact sibling versions when packed; `pack:check` also rejects
version drift between public packages. Other packages remain private. The [release workflow](../../.github/workflows/release.yml)
checks out main and either creates a version PR or publishes versioned packages.

```sh
pnpm changeset
pnpm changeset status
pnpm pack:check
```

`pack:check` validates packed exports and clean npm installation through an
isolated registry. The CLI publishes a shrinkwrap; `pnpm cli:lock` refreshes it
after runtime dependency changes.

Release uses npm trusted publishing and provenance. It does not run CI itself:
verify the exact main commit with CI before dispatching Release. The
`pnpm release` command publishes packages and is not a validation command.

### Templates bootstrap

The initial `@namera-ai/templates@0.0.0` was published manually under the
`bootstrap` tag to configure its npm settings. This local bootstrap has no CI provenance.
In npm's package settings, add the GitHub Actions trusted publisher for
`thenamespace/namera`, workflow `release.yml`, with direct publishing allowed.
The repository's origin alias currently resolves to this public repository;
use its canonical name to match the workflow's OIDC identity.
Leave the environment field empty: the release job declares no environment.
The workflow already grants `id-token: write`; subsequent trusted publishes
generate provenance. See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).

Templates now starts from the same checked-in version as the other public
packages. Its first normal CI release follows the fixed group rather than the
bootstrap version. With the pending Arc minor changeset, all five advance from
`1.6.0` to `1.7.0`. Do not publish another bootstrap version or manually advance
individual package versions.

See [testing](../engineering/testing.md) for validation commands.
