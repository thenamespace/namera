# @namera-ai/sdk

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
