import * as PublicKey from "ox/PublicKey";
import * as Secp256k1 from "ox/Secp256k1";
import * as Signature from "ox/Signature";
import type { Hex } from "viem";

export type DerSignatureToEvmSignatureOptions =
  | {
      readonly validatorType: "webauthn_p256" | "raw_p256";
      readonly derSignature: Uint8Array;
    }
  | {
      readonly validatorType: "ecdsa_secp256k1";
      readonly derSignature: Uint8Array;
      readonly hash: Hex;
      readonly publicKey: Hex;
    };

export const derSignatureToEvmSignature = (options: DerSignatureToEvmSignatureOptions): Hex => {
  const signature = Signature.fromDerBytes(options.derSignature);

  if (options.validatorType !== "ecdsa_secp256k1") {
    return Signature.toHex(signature);
  }

  const curveOrder = Secp256k1.noble.CURVE.n;
  const normalizedSignature = {
    r: signature.r,
    s: signature.s > curveOrder / 2n ? curveOrder - signature.s : signature.s,
  };
  const expectedPublicKey = PublicKey.fromHex(options.publicKey);
  if (expectedPublicKey.y === undefined) {
    throw new Error("An uncompressed secp256k1 public key is required");
  }

  for (const yParity of [0, 1] as const) {
    const recoveredPublicKey = Secp256k1.recoverPublicKey({
      payload: options.hash,
      signature: { ...normalizedSignature, yParity },
    });

    if (
      recoveredPublicKey.x === expectedPublicKey.x &&
      recoveredPublicKey.y === expectedPublicKey.y
    ) {
      return Signature.toHex({ ...normalizedSignature, yParity });
    }
  }

  throw new Error("The DER signature does not match the supplied secp256k1 public key");
};
