import { generateKeyPairSync, sign } from "node:crypto";

import * as P256 from "ox/P256";
import * as Signature from "ox/Signature";
import { decodeAbiParameters, stringToBytes, toHex } from "viem";
import { describe, expect, it } from "vitest";

import {
  encodeVerifiedOwnerAssertion,
  webAuthnSignatureParameters,
} from "../../../src/accounts/passkey-signature.js";

describe("verified owner assertion encoding", () => {
  it("preserves signed bytes, uses UTF-8 offsets and normalizes authenticator high-S", () => {
    const { privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const signature = Signature.fromDerBytes(sign("sha256", Buffer.from("assertion"), privateKey));
    const order = P256.noble.Point.Fn.ORDER;
    const s = BigInt(signature.s);
    const highS = s > order / 2n ? s : order - s;
    const clientDataJSON = '{"extra":"🔑","type":"webauthn.get","challenge":"test"}';
    const assertion = {
      clientDataJSON,
      authenticatorDataHex: toHex(new Uint8Array(37)),
      signatureDerHex: Signature.toDerHex({ r: signature.r, s: toHex(highS, { size: 32 }) }),
    };
    const [encoded] = decodeAbiParameters(
      webAuthnSignatureParameters,
      encodeVerifiedOwnerAssertion(assertion),
    );
    expect(encoded).toEqual({
      authenticatorData: assertion.authenticatorDataHex,
      clientDataJSON,
      challengeIndex: BigInt(
        stringToBytes(clientDataJSON.slice(0, clientDataJSON.indexOf('"challenge"'))).length,
      ),
      typeIndex: BigInt(
        stringToBytes(clientDataJSON.slice(0, clientDataJSON.indexOf('"type"'))).length,
      ),
      r: BigInt(signature.r),
      s: order - highS,
    });
  });

  it("does not silently encode a missing challenge at offset zero", () => {
    expect(() =>
      encodeVerifiedOwnerAssertion({
        clientDataJSON: '{"type":"webauthn.get"}',
        authenticatorDataHex: "0x",
        signatureDerHex: Signature.toDerHex({
          r: toHex(1n, { size: 32 }),
          s: toHex(1n, { size: 32 }),
        }),
      }),
    ).toThrow("Missing WebAuthn challenge field");
  });
});
