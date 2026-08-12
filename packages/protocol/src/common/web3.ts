import { Schema } from "effect";

export const ValidatorType = Schema.Literals(["webauthn_p256", "raw_p256", "ecdsa_secp256k1"]);

export type ValidatorType = typeof ValidatorType.Type;
