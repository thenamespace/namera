# @namera-ai/api

## 1.2.0

### Minor Changes

- ad5a126: Add provider-independent platform membership and team invitation contracts with
  owner, operator and viewer permissions. Internal admin APIs now require a verified
  browser session instead of the retired shared admin bearer token.
- 5afe5dc: Add optional Google sign-in and explicit connected-account APIs, with typed errors, account-change notifications, and Google audit events. Existing email sign-in remains supported.

### Patch Changes

- Updated dependencies [33c0e76]
- Updated dependencies [ad5a126]
- Updated dependencies [5afe5dc]
  - @namera-ai/protocol@1.2.0

## 1.1.1

### Patch Changes

- c21bde9: Update repository, issue tracker, and documentation links to thenamespace/namera.
- Updated dependencies [c21bde9]
  - @namera-ai/protocol@1.1.1

## 1.1.0

### Minor Changes

- 69c4a6a: Migrate to Effect 4.0.1 stable and refresh runtime dependencies. Effect-based
  consumers must also upgrade from the release candidate to 4.0.1 and use the
  stable module paths, including `effect/http-api` instead of
  `effect/unstable/httpapi`. Public HTTP routes and payloads are unchanged.

  Refresh the CLI's pinned npm dependency tree and retain existing signing formats
  and encrypted credential storage behavior across the dependency upgrades.

### Patch Changes

- Updated dependencies [69c4a6a]
  - @namera-ai/protocol@1.1.0

## 1.0.3

### Patch Changes

- @namera-ai/protocol@1.0.3

## 1.0.2

### Patch Changes

- @namera-ai/protocol@1.0.2

## 1.0.1

### Patch Changes

- f20b191: Align Effect dependencies on 4.0.0-rc.117 and update the corresponding runtime APIs. Lock the CLI's published dependency tree to prevent incompatible transitive prereleases from breaking startup. Verify release tarballs through clean npm installations, including CLI login/MCP commands and SDK imports.
- Updated dependencies [f20b191]
  - @namera-ai/protocol@1.0.1

## 1.0.0

### Major Changes

- 395dcb1: Release Namera 1.0.0 with self-custodial smart accounts, locally stored session keys,
  scoped execution and signing, and a local stdio MCP server with browser authorization.
  Use https://api.namera.ai by default. This replaces the pre-1.0 client interfaces.

### Patch Changes

- Updated dependencies [395dcb1]
  - @namera-ai/protocol@1.0.0
