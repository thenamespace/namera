import { Schema } from "effect";

import { Hex } from "#/evm/index";

export const LocalEvmSessionSignerRequest = Schema.Struct({
  custody: Schema.Literal("local"),
  algorithm: Schema.Literal("secp256k1"),
  publicKey: Hex.check(Schema.isPattern(/^0x04[0-9a-f]{128}$/)),
}).annotate({ identifier: "LocalEvmSessionSignerRequest" });

export const OneClawEvmSessionSignerRequest = Schema.Struct({
  custody: Schema.Literal("namera-managed"),
  provider: Schema.Literal("1claw"),
  algorithm: Schema.Literal("secp256k1"),
  publicKey: Schema.optionalKey(Schema.Never),
  privateKey: Schema.optionalKey(Schema.Never),
  agentId: Schema.optionalKey(Schema.Never),
  credentialId: Schema.optionalKey(Schema.Never),
  providerConnectionId: Schema.optionalKey(Schema.Never),
}).annotate({
  identifier: "OneClawEvmSessionSignerRequest",
  description:
    "Request a dedicated provider key. Do not supply key material or provider identifiers.",
});

export const EvmSessionSignerRequest = Schema.Union(
  [LocalEvmSessionSignerRequest, OneClawEvmSessionSignerRequest],
  { mode: "oneOf" },
).annotate({ identifier: "EvmSessionSignerRequest" });

export const EvmSessionSignerResponse = Schema.Union(
  [
    Schema.Struct({
      custody: Schema.Literal("local"),
      algorithm: Schema.Literal("secp256k1"),
      publicKey: Hex,
    }),
    Schema.Struct({
      custody: Schema.Literal("namera-managed"),
      provider: Schema.Literal("1claw"),
      algorithm: Schema.Literal("secp256k1"),
      publicKey: Hex,
    }),
  ],
  { mode: "oneOf" },
).annotate({
  identifier: "EvmSessionSignerResponse",
  description:
    "Public session signer identity. Independent of the parent account owner; contains no provider credentials.",
});

export type EvmSessionSignerRequest = typeof EvmSessionSignerRequest.Type;
export type EvmSessionSignerResponse = typeof EvmSessionSignerResponse.Type;
