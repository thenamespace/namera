import { type Effect, Schema } from "effect";

export interface CryptoInput {
  readonly purpose: string;
  readonly value: string;
}

export interface CryptoVerificationInput extends CryptoInput {
  readonly expected: string;
}

export interface CryptoServiceValue {
  readonly randomToken: (byteLength?: number) => Effect.Effect<string, CryptoError>;
  readonly randomCode: (digits?: number) => Effect.Effect<string, CryptoError>;
  readonly hash: (input: CryptoInput) => Effect.Effect<string, CryptoError>;
  readonly hmac: (input: CryptoInput) => Effect.Effect<string, CryptoError>;
  readonly verifyHmac: (input: CryptoVerificationInput) => Effect.Effect<boolean, CryptoError>;
  readonly encrypt: (input: CryptoInput) => Effect.Effect<string, CryptoError>;
  readonly decrypt: (input: CryptoInput) => Effect.Effect<string, CryptoError>;
}

export class CryptoError extends Schema.TaggedError<CryptoError>()("CryptoError", {
  reason: Schema.Literals([
    "RANDOM_GENERATION_FAILED",
    "HASH_FAILED",
    "HMAC_FAILED",
    "ENCRYPTION_FAILED",
    "DECRYPTION_FAILED",
  ]),
  cause: Schema.Defect(),
}) {}
