import * as Hash from "ox/Hash"
import * as Hex from "ox/Hex"

import * as WebAuthn from "../account/webauthn.ts"
import type { EcdsaSessionKey, PasskeySessionKey } from "../sessionKey.ts"

// What the session validators read as the session key's signature: `ECDSASessionValidator`'s `threshold` 65-byte
// EIP-191 signatures in ascending signer order, or `WebAuthnValidator`'s packed assertions (direct mode, the
// passkeys from the session's config).

/**
 * Concatenates ECDSA signatures by ascending signer address, as `ECDSASessionValidator` requires.
 *
 * @internal
 */
export const ecdsaSignature = (
  signatures: ReadonlyArray<{ readonly signer: Hex.Hex; readonly signature: Hex.Hex }>
): Hex.Hex =>
  Hex.concat(
    // Stryker disable next-line EqualityOperator: signers are distinct, so `<` and `<=` order them the same
    ...[...signatures].sort((a, b) => (BigInt(a.signer) < BigInt(b.signer) ? -1 : 1)).map((entry) => entry.signature)
  )

// 65 bytes that don't compress (an ENABLE-mode signature is compressed, and a stub that compresses better than a real
// signature would underestimate the calldata's gas), with a valid-looking `v`.
const ecdsaStub = (index: number): Hex.Hex =>
  Hex.concat(
    Hash.keccak256(Hex.fromString(`namera.stub.r.${index}`)),
    Hash.keccak256(Hex.fromString(`namera.stub.s.${index}`)),
    "0x1c"
  )

/**
 * A session key signature of the real one's size, for gas estimation: `threshold` ECDSA signatures, or `threshold`
 * passkey assertions with the same backend.
 *
 * @internal
 */
export const stubSignature = (
  sessionKey: EcdsaSessionKey | PasskeySessionKey,
  options: { readonly precompile: boolean }
): Hex.Hex =>
  sessionKey.type === "ecdsa"
    ? Hex.concat(...Array.from({ length: sessionKey.threshold }, (_, index) => ecdsaStub(index)))
    : WebAuthn.stubSignature({
      precompile: options.precompile,
      credentialIds: sessionKey.passkeys.slice(0, sessionKey.threshold).map((passkey) =>
        WebAuthn.credentialId(passkey.publicKey)
      )
    })
