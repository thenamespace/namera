// An agent app handing the grant to wallet tooling: the EIP-1193 provider, its events and an EIP-5792 request. viem's
// wallet client over it (`custom(provider)`, `sendCalls`) is viem's own cost (about 10,600 more), left out. Budgeted by
// its cost over `viem.ts`.
import { Bundler, Grant } from "@namera-ai/sdk"
import { createPublicClient, http } from "viem"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { base } from "viem/chains"

export const client = createPublicClient({ chain: base, transport: http() })
export const sessionKey = privateKeyToAccount(generatePrivateKey())

export const send = async (token: string) => {
  const provider = await Grant.toProvider({
    grant: Grant.parse(token),
    signer: sessionKey,
    client,
    bundler: Bundler.pimlico({ apiKey: "pim_…" })
  })
  provider.on("connect", ({ chainId }) => chainId)
  return provider.request({ method: "wallet_sendCalls", params: [{ version: "2.0.0", calls: [] }] })
}
