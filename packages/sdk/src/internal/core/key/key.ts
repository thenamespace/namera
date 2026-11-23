import * as Address from "ox/Address"
import * as Ed25519 from "ox/Ed25519"
import * as Hex from "ox/Hex"
import * as P256 from "ox/P256"
import * as PublicKey from "ox/PublicKey"
import * as Secp256k1 from "ox/Secp256k1"
import * as Signature from "ox/Signature"

/**
 * The curves a key can be on.
 */
export type Curve = "secp256k1" | "ed25519" | "p256"

/**
 * The curves, in a stable order.
 *
 * @internal
 */
export const curves: ReadonlyArray<Curve> = ["secp256k1", "ed25519", "p256"]

/**
 * A new private key on a curve.
 *
 * @internal
 */
export const generate = (curve: Curve): Hex.Hex => {
  switch (curve) {
    case "secp256k1":
      return Secp256k1.randomPrivateKey()
    case "p256":
      return P256.randomPrivateKey()
    case "ed25519":
      return Ed25519.randomPrivateKey()
  }
}

/**
 * The public key of a private key: uncompressed (`0x04 ‖ x ‖ y`) for secp256k1 and p256, 32 bytes for ed25519.
 *
 * @internal
 */
export const publicKey = (curve: Curve, privateKey: Hex.Hex): Hex.Hex => {
  switch (curve) {
    case "secp256k1":
      return PublicKey.toHex(Secp256k1.getPublicKey({ privateKey }))
    case "p256":
      return PublicKey.toHex(P256.getPublicKey({ privateKey }))
    case "ed25519":
      return Ed25519.getPublicKey({ privateKey })
  }
}

/**
 * Signs a 32-byte digest as it is, without hashing or prefixing it: secp256k1 as `r ‖ s ‖ v` (65 bytes, `v` 27 or 28),
 * p256 as `r ‖ s` (64 bytes), ed25519 as its 64-byte signature. secp256k1 and p256 signatures have a low `s`.
 *
 * @internal
 */
export const sign = (curve: Curve, privateKey: Hex.Hex, digest: Hex.Hex): Hex.Hex => {
  switch (curve) {
    case "secp256k1":
      return Signature.toHex(Secp256k1.sign({ payload: digest, privateKey }))
    case "p256": {
      const { r, s } = P256.sign({ payload: digest, privateKey })
      return Hex.concat(Hex.padLeft(r, 32), Hex.padLeft(s, 32))
    }
    case "ed25519":
      return Ed25519.sign({ payload: digest, privateKey })
  }
}

/**
 * The EVM address of a secp256k1 public key, checksummed.
 *
 * @internal
 */
export const evmAddress = (publicKey: Hex.Hex): Address.Address =>
  Address.checksum(Address.fromPublicKey(PublicKey.fromHex(publicKey)))
