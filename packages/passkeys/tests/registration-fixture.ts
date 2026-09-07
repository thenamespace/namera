import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { isoCBOR } from "@simplewebauthn/server/helpers";

/** A real P-256 packed self-attestation, without a browser or a mocked verifier. */
export const registrationFixture = (input: {
  readonly challenge: string;
  readonly origin: string;
  readonly rpId: string;
  readonly flags?: number;
  readonly tamperSignature?: boolean;
  readonly crossOrigin?: boolean;
}) => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.x === undefined || jwk.y === undefined) throw new Error("Missing P-256 coordinates");
  const x = Buffer.from(jwk.x, "base64url");
  const y = Buffer.from(jwk.y, "base64url");
  const credentialId = randomBytes(32);
  const cose = isoCBOR.encode(
    new Map<number, number | Uint8Array>([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, x],
      [-3, y],
    ]),
  );
  const credentialLength = Buffer.alloc(2);
  credentialLength.writeUInt16BE(credentialId.length);
  const authData = Buffer.concat([
    createHash("sha256").update(input.rpId).digest(),
    Buffer.from([input.flags ?? 0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    credentialLength,
    credentialId,
    cose,
  ]);
  const clientData = Buffer.from(
    JSON.stringify({
      type: "webauthn.create",
      challenge: input.challenge,
      origin: input.origin,
      crossOrigin: input.crossOrigin ?? false,
    }),
  );
  const signature = sign(
    "sha256",
    Buffer.concat([authData, createHash("sha256").update(clientData).digest()]),
    privateKey,
  );
  if (input.tamperSignature) {
    const offset = signature.length - 1;
    signature.writeUInt8(signature.readUInt8(offset) ^ 1, offset);
  }
  const attestation = isoCBOR.encode(
    new Map<string, string | Uint8Array | Map<string, number | Uint8Array>>([
      ["fmt", "packed"],
      ["authData", authData],
      [
        "attStmt",
        new Map<string, number | Uint8Array>([
          ["alg", -7],
          ["sig", signature],
        ]),
      ],
    ]),
  );
  const id = credentialId.toString("base64url");
  return {
    publicKeyHex: `0x04${x.toString("hex")}${y.toString("hex")}`,
    response: {
      id,
      rawId: id,
      type: "public-key",
      authenticatorAttachment: "platform",
      clientExtensionResults: {},
      response: {
        clientDataJSON: clientData.toString("base64url"),
        attestationObject: Buffer.from(attestation).toString("base64url"),
        transports: ["internal"],
      },
    } satisfies RegistrationResponseJSON,
  };
};
