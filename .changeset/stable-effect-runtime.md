---
"@namera-ai/api": major
"@namera-ai/protocol": major
"@namera-ai/sdk": major
"@namera-ai/cli": major
---

Migrate to Effect 4.0.0 stable and refresh runtime dependencies. Effect-based
consumers must also upgrade from the release candidate to 4.0.0 and use the
stable module paths, including `effect/http-api` instead of
`effect/unstable/httpapi`. Public HTTP routes and payloads are unchanged.

Refresh the CLI's pinned npm dependency tree and retain existing signing formats
and encrypted credential storage behavior across the dependency upgrades.
