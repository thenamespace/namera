// The viem-only twin of `owner.ts` and `agent.ts`: what viem alone costs the type checker, so `pnpm type-cost` can
// budget the SDK's share of those consumers.
import { createPublicClient, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const client = createPublicClient({ chain: base, transport: http() })
export const owner = privateKeyToAccount(generatePrivateKey())
