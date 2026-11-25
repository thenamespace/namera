// An agent app: a viem client, a parsed grant turned into an account, and a decoded failure. Budgeted by its cost over
// `viem.ts`.
import { Grant, NameraError } from "@namera-ai/sdk"
import { createPublicClient, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const client = createPublicClient({ chain: base, transport: http() })
export const owner = privateKeyToAccount(generatePrivateKey())

export const account = async (token: string) => {
  const grant = Grant.parse(token)
  try {
    return await Grant.toAccount(client, { grant, signer: owner })
  } catch (error) {
    const decoded = NameraError.decode(error)
    return NameraError.isNameraError(decoded) ? decoded.shortMessage : String(error)
  }
}
