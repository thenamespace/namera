import { baseSepoliaLive } from "./env.test-utils.ts"
import { liveMatrix } from "./matrix.test-utils.ts"

// The live bundler and paymaster matrix on Base Sepolia (`pnpm test:live`); see `test/live/README.md`.
liveMatrix(baseSepoliaLive)
