import { Grant, Policy, Session, SessionKey } from "@namera-ai/sdk"
import { sessionDigest, toTypedData } from "@namera-ai/sdk/internal/core/grant/typedData"
import { contracts } from "@namera-ai/sdk/internal/session/contracts"

// Grants without a chain: an ECDSA session with limits, and an unsafe passkey session with a typed-data policy.

export const account = "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"
export const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
export const passkey =
  "0x6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5"

export const sessions = [
  Session.from({
    signer: SessionKey.ecdsa("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    validUntil: 2_000_000_000,
    label: "checkout",
    policies: [
      Policy.erc20Transfer({ token: USDC, to: [account], amount: { lte: 50_000000n } }),
      Policy.spend({ token: USDC, amount: 200_000000n, period: "day" }),
      Policy.rateLimit({ count: 5, period: { seconds: 600 } })
    ]
  }),
  Session.from({
    signer: SessionKey.passkey({ publicKey: passkey }),
    validUntil: "never",
    unsafe: true,
    sponsored: true,
    policies: [
      Policy.anyCall({ unsafe: true }),
      Policy.signTypedData({
        domain: { name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC },
        types: { Permit: [{ name: "spender", type: "address" }, { name: "value", type: "uint256" }] },
        primaryType: "Permit",
        message: { value: { between: [1n, 5n] } }
      })
    ]
  })
]

/** A grant over chains 8453 and 10, with a stand-in signature (`Grant.verify` would refuse it). */
export const grantOf = (session: Session.Session): Grant.Grant => {
  const chains = [8453, 10].map((chainId) => ({
    chain: `eip155:${chainId}` as const,
    contracts,
    nonce: BigInt(chainId === 10 ? 3 : 0),
    sessionDigest: sessionDigest({
      chainId,
      account,
      compiled: Session.toSmartSession(session),
      smartSession: contracts.smartSession,
      nonce: BigInt(chainId === 10 ? 3 : 0)
    })
  }))
  return Grant.from({
    account: `eip155:8453:${account}`,
    accountType: { type: "kernel", version: "3.3" },
    session,
    chains,
    typedData: toTypedData([]),
    signature: `0x${"ab".repeat(65)}`
  })
}
