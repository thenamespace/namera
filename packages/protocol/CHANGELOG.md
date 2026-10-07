# @namera-ai/protocol

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
