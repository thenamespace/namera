import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

export const authenticationFixture = (input: {
  readonly challenge: string;
  readonly origin: string;
  readonly rpId: string;
  readonly flags?: number;
  readonly counter?: number;
  readonly crossOrigin?: boolean;
  readonly type?: string;
  readonly tamperSignature?: boolean;
}) => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.x === undefined || jwk.y === undefined) throw new Error("Missing P-256 coordinates");
  const publicKeyHex =
    `0x04${Buffer.from(jwk.x, "base64url").toString("hex")}${Buffer.from(jwk.y, "base64url").toString("hex")}` as const;
  const counter = Buffer.alloc(4);
  counter.writeUInt32BE(input.counter ?? 1);
  const authenticatorData = Buffer.concat([
    createHash("sha256").update(input.rpId).digest(),
    Buffer.from([input.flags ?? 0x05]),
    counter,
  ]);
  const clientData = Buffer.from(
    JSON.stringify({
      type: input.type ?? "webauthn.get",
      challenge: input.challenge,
      origin: input.origin,
      crossOrigin: input.crossOrigin ?? false,
    }),
  );
  const signature = sign(
    "sha256",
    Buffer.concat([authenticatorData, createHash("sha256").update(clientData).digest()]),
    privateKey,
  );
  if (input.tamperSignature) {
    const last = signature.length - 1;
    signature.writeUInt8(signature.readUInt8(last) ^ 1, last);
  }
  const id = randomBytes(32).toString("base64url");
  return {
    publicKeyHex,
    response: {
      id,
      rawId: id,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        authenticatorData: authenticatorData.toString("base64url"),
        clientDataJSON: clientData.toString("base64url"),
        signature: signature.toString("base64url"),
      },
    } satisfies AuthenticationResponseJSON,
  };
};
