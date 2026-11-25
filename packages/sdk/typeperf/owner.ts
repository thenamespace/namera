// An owner app: a viem client, a Kernel account, a session and a grant, and narrowing a failure. Budgeted by its cost
// over `viem.ts`.
import { Grant, KernelAccount, NameraError, Policy, Session, SessionKey } from "@namera-ai/sdk"
import { createPublicClient, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const client = createPublicClient({ chain: base, transport: http() })
export const owner = privateKeyToAccount(generatePrivateKey())

export const grant = async (agent: `0x${string}`) => {
  const account = await KernelAccount.from({ client, owner })
  const session = Session.from({
    signer: SessionKey.ecdsa(agent),
    validUntil: Session.expiresIn({ days: 7 }),
    policies: [
      Policy.erc20Transfer({ token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", amount: { lte: 50_000000n } })
    ]
  })
  try {
    return Grant.serialize(await Grant.create({ account, session }), { format: "token" })
  } catch (error) {
    if (NameraError.isNameraError(error)) console.log(error.shortMessage)
    throw error
  }
}
