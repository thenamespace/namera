import { Context, Effect, Layer } from "effect";

import { encodeUtf8 } from "@namera-ai/utils";
import {
  generateRegistrationOptions as generateSimpleWebAuthnRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { convertCOSEtoPKCS, COSEALG } from "@simplewebauthn/server/helpers";

import { PasskeyError } from "./error.js";

export interface GeneratePasskeyRegistrationOptionsInput {
  readonly rpName: string;
  readonly rpId: string;
  readonly userId: string;
  readonly userName: string;
  readonly userDisplayName: string;
  readonly timeoutMs: number;
}

export interface VerifyPasskeyRegistrationInput {
  readonly response: unknown;
  readonly expectedChallenge: string;
  readonly expectedOrigin: string;
  readonly expectedRpId: string;
}

export interface VerifiedPasskeyRegistration {
  readonly credentialId: string;
  readonly publicKeyHex: `0x${string}`;
  readonly transports: ReadonlyArray<"ble" | "hybrid" | "internal" | "nfc" | "usb">;
  readonly signCount: number;
  readonly rpId: string;
}

export interface PasskeysService {
  readonly generateRegistrationOptions: (
    input: GeneratePasskeyRegistrationOptionsInput,
  ) => Effect.Effect<PublicKeyCredentialCreationOptionsJSON, PasskeyError>;
  readonly verifyRegistration: (
    input: VerifyPasskeyRegistrationInput,
  ) => Effect.Effect<VerifiedPasskeyRegistration, PasskeyError>;
}

export class Passkeys extends Context.Service<Passkeys, PasskeysService>()(
  "@namera-ai/passkeys/Passkeys",
) {
  static readonly layer = Layer.succeed(
    this,
    Passkeys.of({
      generateRegistrationOptions: Effect.fn("passkeys.generateRegistrationOptions")((input) =>
        Effect.tryPromise({
          try: () =>
            generateSimpleWebAuthnRegistrationOptions({
              rpName: input.rpName,
              rpID: input.rpId,
              userID: encodeUtf8(input.userId),
              userName: input.userName,
              userDisplayName: input.userDisplayName,
              timeout: input.timeoutMs,
              attestationType: "none",
              authenticatorSelection: {
                residentKey: "required",
                requireResidentKey: true,
                userVerification: "required",
              },
              supportedAlgorithmIDs: [COSEALG.ES256],
            }),
          catch: (cause) => new PasskeyError({ operation: "generate-registration-options", cause }),
        }),
      ),
      verifyRegistration: Effect.fn("passkeys.verifyRegistration")(function* (input) {
        const verification = yield* Effect.tryPromise({
          try: () =>
            verifyRegistrationResponse({
              response: input.response as RegistrationResponseJSON,
              expectedChallenge: input.expectedChallenge,
              expectedOrigin: input.expectedOrigin,
              expectedRPID: input.expectedRpId,
              requireUserPresence: true,
              requireUserVerification: true,
              supportedAlgorithmIDs: [COSEALG.ES256],
            }),
          catch: (cause) => new PasskeyError({ operation: "verify-registration", cause }),
        });
        if (!verification.verified) {
          return yield* new PasskeyError({
            operation: "verify-registration",
            cause: new Error("Passkey registration response was not verified"),
          });
        }

        const credential = verification.registrationInfo.credential;
        const publicKey = convertCOSEtoPKCS(credential.publicKey);
        if (publicKey.length !== 65 || publicKey[0] !== 4) {
          return yield* new PasskeyError({
            operation: "verify-registration",
            cause: new Error("Passkey registration did not produce a P-256 public key"),
          });
        }

        const transports = (credential.transports ?? []).filter(
          (transport): transport is "ble" | "hybrid" | "internal" | "nfc" | "usb" =>
            transport === "ble" ||
            transport === "hybrid" ||
            transport === "internal" ||
            transport === "nfc" ||
            transport === "usb",
        );

        return {
          credentialId: credential.id,
          publicKeyHex: `0x${Buffer.from(publicKey).toString("hex")}`,
          transports,
          signCount: credential.counter,
          rpId: input.expectedRpId,
        };
      }),
    }),
  );

  static readonly testLayer = Layer.effect(
    this,
    Effect.gen(function* () {
      const live = yield* Passkeys;
      return Passkeys.of({
        ...live,
        verifyRegistration: Effect.fn("passkeys.test.verifyRegistration")(function* (input) {
          const response = input.response as { readonly id?: unknown };
          if (response.id !== "test-passkey") {
            return yield* new PasskeyError({
              operation: "verify-registration",
              cause: new Error("Invalid test passkey response"),
            });
          }
          return {
            credentialId: response.id,
            publicKeyHex: `0x04${"01".repeat(64)}`,
            transports: ["internal"] as const,
            signCount: 0,
            rpId: input.expectedRpId,
          };
        }),
      });
    }),
  ).pipe(Layer.provide(this.layer));
}
