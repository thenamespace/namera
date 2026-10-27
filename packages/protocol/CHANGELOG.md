# @namera-ai/protocol

## 1.7.0

### Minor Changes

- bbf4ae3: Support Arc mainnet and testnet network identifiers and USDC-denominated gas quotes. Add Arc to CLI network selection and preserve existing ETH quote decoding.

## 1.6.0

### Minor Changes

- b60f9d6: Add explicit workspace API-key permissions for account and session provisioning,
  installation, removal, and revocation. Expose SDK management and owner-approval
  methods with internally managed idempotency and operation recovery. Support
  actor-bound passkey registration on approved application origins.

## 1.5.0

### Minor Changes

- 955539e: Add actor-scoped cancellation endpoints for unsigned wallet transactions, session-key approvals, and delegated execution preparations. Cancellation releases applicable reservations atomically, rejects signed or pending transactions and active signing leases, and exposes a terminal cancelled status.

## 1.4.0

### Minor Changes

- 2182be1: Replace the pre-launch session creation payload's shared onchain configuration
  with `onchain.installations`. Each entry supplies `chainId`, `validAfter`,
  `validUntil`, `permissions`, and optional `allowSignatures`. Session-level API
  `policies` remain separate. The old request shape is no longer accepted.

  Registration verification now matches each response installation to the reviewed
  configuration for its chain, including its permissions, dates and signature flag.
  Existing stored sessions, encrypted exports and local signing bindings remain
  compatible. SDK list/get and CLI commands are unchanged; the four packages release
  together in the existing fixed version group.

## 1.3.0

### Minor Changes

- 4b4bfc5: Replace legacy address enrichment with Alchemy portfolios. Remove address-metadata endpoints and models, add exact per-asset USD values, and support explicit portfolio refresh with five-minute account caching. Clients must stop reading `addressMetadata` and use asset metadata instead.
- e87b570: Add 1Claw-managed smart-account owners and session keys, including custody-aware creation, owner approvals, execution, and signing. Support local and managed session keys with either passkey-owned or 1Claw-managed accounts.

  Use the same SDK execution and signing methods, CLI commands, and MCP tools for both session-key custody types. Managed session keys require no local key import or signer resolver; local keys continue signing on the client. Add public custody and signing-method schemas and fix managed smart-account signature verification.

  For self-funded managed executions, configure `maxGasCostWei` on `NameraClient`. Managed signature completion is not automatically retried: retrying a lost result with a new signing request may consume another signature allowance.

## 1.2.0

### Minor Changes

- 33c0e76: Add an optional admin surface to email and Google sign-in requests, preserving
  the configured portal destination through verification and Google callback errors.
- ad5a126: Add provider-independent platform membership and team invitation contracts with
  owner, operator and viewer permissions. Internal admin APIs now require a verified
  browser session instead of the retired shared admin bearer token.
- 5afe5dc: Add optional Google sign-in and explicit connected-account APIs, with typed errors, account-change notifications, and Google audit events. Existing email sign-in remains supported.

## 1.1.1

### Patch Changes

- c21bde9: Update repository, issue tracker, and documentation links to thenamespace/namera.

## 1.1.0

### Minor Changes

- 69c4a6a: Migrate to Effect 4.0.1 stable and refresh runtime dependencies. Effect-based
  consumers must also upgrade from the release candidate to 4.0.1 and use the
  stable module paths, including `effect/http-api` instead of
  `effect/unstable/httpapi`. Public HTTP routes and payloads are unchanged.

  Refresh the CLI's pinned npm dependency tree and retain existing signing formats
  and encrypted credential storage behavior across the dependency upgrades.

## 1.0.3

No changes in this release.

## 1.0.2

No changes in this release.

## 1.0.1

### Patch Changes

- f20b191: Align Effect dependencies on 4.0.0-rc.117 and update the corresponding runtime APIs. Lock the CLI's published dependency tree to prevent incompatible transitive prereleases from breaking startup. Verify release tarballs through clean npm installations, including CLI login/MCP commands and SDK imports.

## 1.0.0

### Major Changes

- 395dcb1: Release Namera 1.0.0 with self-custodial smart accounts, locally stored session keys,
  scoped execution and signing, and a local stdio MCP server with browser authorization.
  Use https://api.namera.ai by default. This replaces the pre-1.0 client interfaces.
