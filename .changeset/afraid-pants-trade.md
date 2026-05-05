---
"@namera-ai/cli": patch
---

- Upgraded `effect` to `4.0.0-beta.60` for improved stability and compatibility with the latest Effect ecosystem
- Removed `json-nd` dependency and replaced with inline handling logic to reduce dependency surface and improve control
- Switched to unbundled output in tsdown to preserve file structure and improve runtime compatibility across npm, pnpm, and bun