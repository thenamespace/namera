import * as Base64 from "ox/Base64"
import * as Bytes from "ox/Bytes"
import * as Hex from "ox/Hex"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"
import * as Signature from "ox/Signature"
import * as WebAuthnP256 from "ox/WebAuthnP256"
import { toWebAuthnAccount, type WebAuthnAccount } from "viem/account-abstraction"

/**
 * A passkey without a browser: viem's own WebAuthn account, whose `getFn` (the hook viem offers for environments
 * without `navigator.credentials`) answers like an authenticator would, signing the real WebAuthn payload with a
 * P-256 key.
 */
export const newPasskey = (): WebAuthnAccount => {
  const privateKey = P256.randomPrivateKey()
  const publicKey = PublicKey.toHex(P256.getPublicKey({ privateKey }))
  const id = Base64.fromBytes(Bytes.random(16), { url: true, pad: false })

  return toWebAuthnAccount({
    credential: { id, publicKey },
    rpId: "localhost",
    getFn: async (options) => {
      const challenge = Hex.fromBytes(new Uint8Array(options!.publicKey!.challenge as ArrayBuffer))
      const { metadata, payload } = WebAuthnP256.getSignPayload({
        challenge,
        origin: "http://localhost",
        rpId: "localhost"
      })
      const signature = P256.sign({ payload, privateKey, hash: true })
      const buffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
      return {
        id,
        type: "public-key",
        response: {
          authenticatorData: buffer(Bytes.fromHex(metadata.authenticatorData)),
          clientDataJSON: buffer(Bytes.fromString(metadata.clientDataJSON)),
          signature: buffer(Signature.toDerBytes(signature))
        }
      } as never
    }
  })
}
