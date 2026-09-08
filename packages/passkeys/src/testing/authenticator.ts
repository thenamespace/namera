import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";

import { Effect, Layer } from "effect";

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import { Passkeys } from "../service.js";

export { createTestRegistration } from "./registration.js";

export interface TestAuthenticationInput {
  readonly challenge: string;
  readonly origin: string;
  readonly rpId: string;
  readonly counter?: number;
  readonly flags?: number;
  readonly crossOrigin?: boolean;
  readonly type?: string;
  readonly tamperSignature?: boolean;
}

/** Ephemeral test authenticator. Private material never leaves this closure. */
export const createTestAuthenticator = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.x === undefined || jwk.y === undefined) throw new Error("Missing P-256 coordinates");
  const publicKeyHex =
    `0x04${Buffer.from(jwk.x, "base64url").toString("hex")}${Buffer.from(jwk.y, "base64url").toString("hex")}` as const;
  const credentialId = randomBytes(32).toString("base64url");
  const authenticate = (input: TestAuthenticationInput): AuthenticationResponseJSON => {
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
    return {
      id: credentialId,
      rawId: credentialId,
      type: "public-key",
      clientExtensionResults: {},
      response: {
        authenticatorData: authenticatorData.toString("base64url"),
        clientDataJSON: clientData.toString("base64url"),
        signature: signature.toString("base64url"),
      },
    };
  };
  // Registration is replaced only to provision a test wallet; authentication
  // retains the actual SimpleWebAuthn cryptographic verifier.
  const layer = Layer.effect(
    Passkeys,
    Effect.gen(function* () {
      const live = yield* Passkeys;
      return Passkeys.of({
        ...live,
        verifyRegistration: Effect.fn("passkeys.test.provisionAuthenticator")((input) =>
          Effect.succeed({
            credentialId,
            publicKeyHex,
            transports: ["internal"] as const,
            signCount: 0,
            rpId: input.expectedRpId,
          }),
        ),
      });
    }),
  ).pipe(Layer.provide(Passkeys.layer));
  return { credentialId, publicKeyHex, authenticate, layer };
};
