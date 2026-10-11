---
"@namera-ai/sdk": minor
"@namera-ai/cli": minor
---

Automatically resolve imported local session keys in Node.js for `executions.execute()`
and `sign()`, without requiring `resolveSessionSigner`. SDK, CLI, and local MCP now
share the same encrypted files, OS-keyring unlock, and trusted installation bindings.

Keep browser bundles free of native keyring dependencies through conditional exports.
Custom resolvers remain supported, and `localSigning: false` disables automatic
key-store access. Managed operations do not load the local key store. Add Node-only
storage APIs at `@namera-ai/sdk/node` for custom import workflows.

Accept plain IDs and hex addresses in SDK client inputs while preserving typed
namespaces, supported chain IDs, and bigint amounts. Export SDK input types and
validate inputs against protocol schemas before requests or signing.
