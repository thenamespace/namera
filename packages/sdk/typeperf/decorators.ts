// A viem client with the decorator, reading a grant's status and an account through it. Budgeted by its cost over
// `viem.ts`.
import type { Grant } from "@namera-ai/sdk"
import { nameraActions } from "@namera-ai/sdk/decorators"
import { createPublicClient, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const client = createPublicClient({ chain: base, transport: http() }).extend(nameraActions())
export const owner = privateKeyToAccount(generatePrivateKey())

export const status = async (grant: Grant.Grant) => {
  const { state } = await client.namera.grant.getStatus({ grant })
  const detected = await client.namera.account.detect({ address: owner.address })
  return [state, detected.type] as const
}
