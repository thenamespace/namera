import * as PublicKey from "ox/PublicKey";
import * as Secp256k1 from "ox/Secp256k1";
import * as Signature from "ox/Signature";
import { bytesToHex, numberToHex, type Hex } from "viem";

/** Validate the provider's recovery byte before normalizing a high-S signature. */
export const recoverableSignatureToEvmSignature = (input: {
  readonly signature: Uint8Array;
  readonly hash: Hex;
  readonly publicKey: Hex;
}): Hex => {
  const recovery = input.signature[64];
  if (input.signature.length !== 65 || ![0, 1, 27, 28].includes(recovery ?? -1)) {
    throw new Error("Expected a 65-byte secp256k1 signature with recovery byte 0, 1, 27 or 28");
  }
  const signature = Signature.fromHex(bytesToHex(input.signature));
  const expected = PublicKey.fromHex(input.publicKey);
  const recovered = Secp256k1.recoverPublicKey({ payload: input.hash, signature });
  if (expected.x !== recovered.x || expected.y !== recovered.y) {
    throw new Error("The signature does not match the supplied secp256k1 public key and digest");
  }

  const order = Secp256k1.noble.Point.Fn.ORDER;
  const s = BigInt(signature.s);
  return Signature.toHex({
    r: signature.r,
    s: numberToHex(s > order / 2n ? order - s : s, { size: 32 }),
    yParity: (s > order / 2n ? signature.yParity ^ 1 : signature.yParity) as 0 | 1,
  });
};
