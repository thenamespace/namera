// A viem local account whose signatures come from a function that signs a 32-byte hash, as viem's own
// `privateKeyToAccount` builds them (viem 3: `Account.from({ publicKey, sign })`).
import type { LocalAccount, Signature, TransactionSerializable } from "viem"
import { hashMessage, hashTypedData, keccak256, parseSignature, serializeTransaction } from "viem"
import { toAccount } from "viem/accounts"
import { hashAuthorization } from "viem/utils"

import type { Hex } from "./client.ts"

/**
 * A viem local account: it signs messages, typed data, transactions and EIP-7702 authorizations itself.
 */
export type { LocalAccount }

/**
 * Builds a local account from a function that signs a hash as `r ‖ s ‖ v` (65 bytes).
 *
 * @internal
 */
export const localAccount = (options: {
  readonly address: Hex
  readonly publicKey: Hex
  readonly sign: (hash: Hex) => Promise<Hex>
}): LocalAccount => {
  const { address, publicKey, sign } = options
  const account = toAccount({
    address,
    sign: ({ hash }) => sign(hash),
    signMessage: ({ message }) => sign(hashMessage(message)),
    signTypedData: (typedData) => sign(hashTypedData(typedData as Parameters<typeof hashTypedData>[0])),
    signAuthorization: async (authorization) => {
      const target = authorization.contractAddress ?? authorization.address
      const signature = parseSignature(
        await sign(hashAuthorization({ address: target, chainId: authorization.chainId, nonce: authorization.nonce }))
      )
      return { address: target, chainId: authorization.chainId, nonce: authorization.nonce, ...signature }
    },
    signTransaction: async (transaction, { serializer = serializeTransaction } = {}) => {
      // An EIP-4844 transaction signs its payload without the sidecars, as viem does.
      const signable = transaction.type === "eip4844" ? { ...transaction, sidecars: false } : transaction
      const signature: Signature = parseSignature(
        await sign(keccak256(await serializer(signable as TransactionSerializable)))
      )
      return serializer(transaction, signature)
    }
  })
  return { ...account, publicKey }
}
