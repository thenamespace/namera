import * as Effect from "effect/Effect"

import * as WebAuthn from "../../internal/core/account/webauthn.ts"
import type { Hex } from "../../internal/viem/client.ts"
import { type SmartAccount, userOperationHash, type UserOperationToSign } from "../../internal/viem/smartAccount.ts"
import * as AccountError from "../AccountError.ts"
import * as Passkeys from "./passkeys.ts"

/**
 * One account's prepared user operation to sign in a multichain signature.
 *
 * @internal
 */
export interface Entry {
  readonly account: SmartAccount
  readonly userOperation: UserOperationToSign
}

const accountOf = (account: SmartAccount): AccountError.Options["account"] => ({
  type: (account as { readonly namera?: { readonly type: "kernel" | "nexus" | "safe7579" } }).namera?.type ??
    "unknown",
  address: account.address
})

const signingOf = (account: SmartAccount): Effect.Effect<Passkeys.Signing, AccountError.AccountError> => {
  const signing = Passkeys.signingOf(account)
  return signing === undefined
    ? Effect.fail(AccountError.invalidOptions({
      account: accountOf(account),
      detail: "multichain signatures need an account Namera built with passkey owners"
    }))
    : Effect.succeed(signing)
}

/**
 * Signs user operations on several chains with one prompt per signing passkey: the passkeys sign a Merkle root of the
 * user operation hashes, and each signature carries its operation's proof.
 *
 * @internal
 */
export const signUserOperations = Effect.fnUntraced(function*(
  entries: ReadonlyArray<Entry>
): Effect.fn.Return<ReadonlyArray<Hex>, AccountError.AccountError> {
  const [first] = entries
  if (first === undefined) return []
  const signings = yield* Effect.forEach(entries, ({ account }) => signingOf(account))
  const signers = signings[0]!.credentialIds.join()
  const other = signings.findIndex((signing) => signing.credentialIds.join() !== signers)
  if (other !== -1) {
    return yield* AccountError.invalidOptions({
      account: accountOf(entries[other]!.account),
      detail: "every account in a multichain signature must be signed by the same passkeys"
    })
  }

  const hashes = entries.map(({ account, userOperation }) =>
    userOperationHash({ userOperation, sender: account.address, chainId: account.client.chain!.id })
  )
  const { proofs, root } = WebAuthn.multichainTree(hashes)
  const assertions = yield* signings[0]!.assert(WebAuthn.multichainChallenge(root))
  return signings.map((signing, index) =>
    WebAuthn.encodeSignature({
      precompile: signing.precompile,
      multichain: { root, proof: proofs[index]! },
      assertions
    })
  )
})

/**
 * A stub signature of a multichain signature's shape, for preparing one of `count` user operations: it covers the
 * proof the real signature carries.
 *
 * @internal
 */
export const stubSignature = (
  account: SmartAccount,
  count: number
): Effect.Effect<Hex, AccountError.AccountError> =>
  signingOf(account).pipe(Effect.map((signing) =>
    WebAuthn.stubSignature({
      precompile: signing.precompile,
      credentialIds: signing.credentialIds,
      multichainProofLength: Math.ceil(Math.log2(Math.max(count, 1)))
    })
  ))
