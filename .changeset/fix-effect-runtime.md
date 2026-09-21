---
"@namera-ai/api": patch
"@namera-ai/protocol": patch
"@namera-ai/sdk": patch
"@namera-ai/cli": patch
---

Align Effect dependencies on 4.0.0-rc.117 and update the corresponding runtime APIs. Lock the CLI's published dependency tree to prevent incompatible transitive prereleases from breaking startup. Verify release tarballs through clean npm installations, including CLI login/MCP commands and SDK imports.
