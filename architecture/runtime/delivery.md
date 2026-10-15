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

`api`, `protocol`, `sdk`, and `cli` form one fixed Changesets group. Other
packages remain private. The [release workflow](../../.github/workflows/release.yml)
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

See [testing](../engineering/testing.md) for validation commands.
