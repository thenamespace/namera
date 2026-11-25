import { sepoliaLive } from "./env.test-utils.ts"
import { liveMatrix } from "./matrix.test-utils.ts"

// The live bundler and paymaster matrix on Sepolia (`pnpm test:live`); see `test/live/README.md`.
liveMatrix(sepoliaLive)
