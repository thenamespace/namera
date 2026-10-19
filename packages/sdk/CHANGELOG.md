# @namera-ai/sdk

## 1.6.0

### Minor Changes

- b60f9d6: Add explicit workspace API-key permissions for account and session provisioning,
  installation, removal, and revocation. Expose SDK management and owner-approval
  methods with internally managed idempotency and operation recovery. Support
  actor-bound passkey registration on approved application origins.

### Patch Changes

- Updated dependencies [b60f9d6]
  - @namera-ai/api@1.6.0
  - @namera-ai/protocol@1.6.0

## 1.5.0

### Patch Changes

- Updated dependencies [955539e]
  - @namera-ai/api@1.5.0
  - @namera-ai/protocol@1.5.0

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

### Patch Changes

- Updated dependencies [2182be1]
  - @namera-ai/protocol@1.4.0
  - @namera-ai/api@1.4.0

## 1.3.0

### Minor Changes

- 7f71f55: Automatically resolve imported local session keys in Node.js for `executions.execute()`
  and `sign()`, without requiring `resolveSessionSigner`. SDK, CLI, and local MCP now
  share the same encrypted files, OS-keyring unlock, and trusted installation bindings.

  Keep browser bundles free of native keyring dependencies through conditional exports.
  Custom resolvers remain supported, and `localSigning: false` disables automatic
  key-store access. Managed operations do not load the local key store. Add Node-only
  storage APIs at `@namera-ai/sdk/node` for custom import workflows.

  Accept plain IDs and hex addresses in SDK client inputs while preserving typed
  namespaces, supported chain IDs, and bigint amounts. Export SDK input types and
  validate inputs against protocol schemas before requests or signing.

- 4b4bfc5: Replace legacy address enrichment with Alchemy portfolios. Remove address-metadata endpoints and models, add exact per-asset USD values, and support explicit portfolio refresh with five-minute account caching. Clients must stop reading `addressMetadata` and use asset metadata instead.
- e87b570: Add 1Claw-managed smart-account owners and session keys, including custody-aware creation, owner approvals, execution, and signing. Support local and managed session keys with either passkey-owned or 1Claw-managed accounts.

  Use the same SDK execution and signing methods, CLI commands, and MCP tools for both session-key custody types. Managed session keys require no local key import or signer resolver; local keys continue signing on the client. Add public custody and signing-method schemas and fix managed smart-account signature verification.

  For self-funded managed executions, configure `maxGasCostWei` on `NameraClient`. Managed signature completion is not automatically retried: retrying a lost result with a new signing request may consume another signature allowance.

### Patch Changes

- Updated dependencies [4b4bfc5]
- Updated dependencies [e87b570]
  - @namera-ai/protocol@1.3.0
  - @namera-ai/api@1.3.0

## 1.2.0

### Patch Changes

- Updated dependencies [33c0e76]
- Updated dependencies [ad5a126]
- Updated dependencies [5afe5dc]
  - @namera-ai/protocol@1.2.0
  - @namera-ai/api@1.2.0

## 1.1.1

### Patch Changes

- c21bde9: Update repository, issue tracker, and documentation links to thenamespace/namera.
- Updated dependencies [c21bde9]
  - @namera-ai/api@1.1.1
  - @namera-ai/protocol@1.1.1

## 1.1.0

### Minor Changes

- 1e14605: Add optional flags and guided wallet/session-key selection for execution, simulation, signing, and signature verification. Improve validation and recovery instructions, transaction summaries, and MCP connection output while preserving structured JSON responses.

  Expose `client.executions.get(executionId)` in the SDK for full execution details, including transaction hashes, account, session key, and actor information.

- 69c4a6a: Migrate to Effect 4.0.1 stable and refresh runtime dependencies. Effect-based
  consumers must also upgrade from the release candidate to 4.0.1 and use the
  stable module paths, including `effect/http-api` instead of
  `effect/unstable/httpapi`. Public HTTP routes and payloads are unchanged.

  Refresh the CLI's pinned npm dependency tree and retain existing signing formats
  and encrypted credential storage behavior across the dependency upgrades.

### Patch Changes

- Updated dependencies [69c4a6a]
  - @namera-ai/api@1.1.0
  - @namera-ai/protocol@1.1.0

## 1.0.3

### Patch Changes

- @namera-ai/api@1.0.3
  - @namera-ai/protocol@1.0.3

## 1.0.2

### Patch Changes

- @namera-ai/api@1.0.2
  - @namera-ai/protocol@1.0.2

## 1.0.1

### Patch Changes

- f20b191: Align Effect dependencies on 4.0.0-rc.117 and update the corresponding runtime APIs. Lock the CLI's published dependency tree to prevent incompatible transitive prereleases from breaking startup. Verify release tarballs through clean npm installations, including CLI login/MCP commands and SDK imports.
- Updated dependencies [f20b191]
  - @namera-ai/api@1.0.1
  - @namera-ai/protocol@1.0.1

## 1.0.0

### Major Changes

- 395dcb1: Release Namera 1.0.0 with self-custodial smart accounts, locally stored session keys,
  scoped execution and signing, and a local stdio MCP server with browser authorization.
  Use https://api.namera.ai by default. This replaces the pre-1.0 client interfaces.

### Patch Changes

- Updated dependencies [395dcb1]
  - @namera-ai/api@1.0.0
  - @namera-ai/protocol@1.0.0
