import { Effect } from "effect";

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import { isoCBOR } from "@simplewebauthn/server/helpers";

import { assertFirstPartyClientData } from "./client-data.js";
import { PasskeyError } from "./error.js";

export interface GeneratePasskeyAuthenticationOptionsInput {
  readonly rpId: string;
  readonly credentialId: string;
  /** Exact operation digest bytes, not the UTF-8 text of its hex encoding. */
  readonly challenge: Uint8Array<ArrayBuffer>;
  readonly timeoutMs: number;
}

export interface VerifyPasskeyAuthenticationInput {
  readonly response: unknown;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string;
  readonly expectedRpId: string;
  readonly credentialId: string;
  readonly publicKeyHex: `0x${string}`;
  readonly signCount: number;
}

export interface VerifiedPasskeyAuthentication {
  readonly credentialId: string;
  readonly signCount: number;
  readonly authenticatorDataHex: `0x${string}`;
  readonly clientDataJSON: string;
  readonly signatureDerHex: `0x${string}`;
}

export const makeAuthenticationOptions = Effect.fn("passkeys.generateAuthenticationOptions")(
  (
    input: GeneratePasskeyAuthenticationOptionsInput,
  ): Effect.Effect<PublicKeyCredentialRequestOptionsJSON, PasskeyError> =>
    Effect.tryPromise({
      try: () =>
        generateAuthenticationOptions({
          rpID: input.rpId,
          challenge: input.challenge,
          timeout: input.timeoutMs,
          userVerification: "required",
          allowCredentials: [{ id: input.credentialId }],
        }),
      catch: (cause) => new PasskeyError({ operation: "generate-authentication-options", cause }),
    }),
);

export const verifyAuthentication = Effect.fn("passkeys.verifyAuthentication")(
  (
    input: VerifyPasskeyAuthenticationInput,
  ): Effect.Effect<VerifiedPasskeyAuthentication, PasskeyError> =>
    Effect.tryPromise({
      try: async (): Promise<VerifiedPasskeyAuthentication> => {
        const response = input.response as AuthenticationResponseJSON;
        if (response?.id !== input.credentialId)
          throw new Error("Authentication credential does not match the wallet owner");
        assertFirstPartyClientData(response.response.clientDataJSON);
        if (!/^0x04[0-9a-fA-F]{128}$/.test(input.publicKeyHex))
          throw new Error("Expected an uncompressed P-256 public key");
        const publicKey = Buffer.from(input.publicKeyHex.slice(2), "hex");
        const cose = isoCBOR.encode(
          new Map<number, number | Uint8Array>([
            [1, 2],
            [3, -7],
            [-1, 1],
            [-2, publicKey.subarray(1, 33)],
            [-3, publicKey.subarray(33, 65)],
          ]),
        );
        const result = await verifyAuthenticationResponse({
          response,
          expectedChallenge: input.expectedChallenge,
          expectedOrigin: input.expectedOrigin,
          expectedRPID: input.expectedRpId,
          requireUserVerification: true,
          credential: { id: input.credentialId, publicKey: cose, counter: input.signCount },
        });
        if (!result.verified) throw new Error("Passkey authentication signature is invalid");
        return {
          credentialId: input.credentialId,
          signCount: result.authenticationInfo.newCounter,
          authenticatorDataHex: `0x${Buffer.from(response.response.authenticatorData, "base64url").toString("hex")}`,
          clientDataJSON: Buffer.from(response.response.clientDataJSON, "base64url").toString(
            "utf8",
          ),
          signatureDerHex: `0x${Buffer.from(response.response.signature, "base64url").toString("hex")}`,
        };
      },
      catch: (cause) => new PasskeyError({ operation: "verify-authentication", cause }),
    }),
);
