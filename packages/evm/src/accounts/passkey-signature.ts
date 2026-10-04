import * as P256 from "ox/P256";
import * as Signature from "ox/Signature";
import { encodeAbiParameters, stringToBytes, type Hex } from "viem";
import type { WebAuthnSignReturnType } from "viem/account-abstraction";

export const webAuthnSignatureParameters = [
  {
    name: "params",
    type: "tuple",
    components: [
      { name: "authenticatorData", type: "bytes" },
      { name: "clientDataJSON", type: "string" },
      { name: "challengeIndex", type: "uint256" },
      { name: "typeIndex", type: "uint256" },
      { name: "r", type: "uint256" },
      { name: "s", type: "uint256" },
    ],
  },
] as const;

export const encodeWebAuthnSignature = ({ signature, webauthn }: WebAuthnSignReturnType): Hex => {
  const parsed = Signature.fromHex(signature);
  // Authenticators need not return low-S, but the deployed Solidity verifier requires it.
  const order = P256.noble.Point.Fn.ORDER;
  const s = BigInt(parsed.s);
  return encodeAbiParameters(webAuthnSignatureParameters, [
    {
      authenticatorData: webauthn.authenticatorData,
      clientDataJSON: webauthn.clientDataJSON,
      challengeIndex: BigInt(webauthn.challengeIndex ?? 0),
      typeIndex: BigInt(webauthn.typeIndex ?? 0),
      r: BigInt(parsed.r),
      s: s > order / 2n ? order - s : s,
    },
  ]);
};

export interface VerifiedOwnerAssertion {
  readonly authenticatorDataHex: Hex;
  readonly clientDataJSON: string;
  readonly signatureDerHex: Hex;
}

/** Encode only after the passkey service has verified credential, challenge, origin and UV. */
export const encodeVerifiedOwnerAssertion = (assertion: VerifiedOwnerAssertion): Hex => {
  const indexOf = (field: string) => {
    const index = assertion.clientDataJSON.indexOf(`"${field}":`);
    if (index < 0) throw new Error(`Missing WebAuthn ${field} field`);
    // Solidity indexes UTF-8 bytes, not JavaScript UTF-16 code units.
    return BigInt(stringToBytes(assertion.clientDataJSON.slice(0, index)).length);
  };
  const parsed = Signature.fromDerHex(assertion.signatureDerHex);
  const order = P256.noble.Point.Fn.ORDER;
  const s = BigInt(parsed.s);
  return encodeAbiParameters(webAuthnSignatureParameters, [
    {
      authenticatorData: assertion.authenticatorDataHex,
      clientDataJSON: assertion.clientDataJSON,
      challengeIndex: indexOf("challenge"),
      typeIndex: indexOf("type"),
      r: BigInt(parsed.r),
      s: s > order / 2n ? order - s : s,
    },
  ]);
};
