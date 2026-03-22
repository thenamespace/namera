import { Schema, Struct } from "effect";

import { PolicyParams, SupportedChain } from "@/schema";

import { Keystore } from "./keystore";

export const SessionKey = Schema.Struct({
  smartAccountAlias: Schema.String,
  sessionKeyAddress: Schema.String,
  serializedAccounts: Schema.Array(
    Schema.Struct({
      chain: SupportedChain,
      serializedAccount: Schema.String,
    }),
  ),
}).mapFields(Struct.assign(Keystore.fields));

export const CreateSessionKeyParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the session key to create",
  }),
  chains: Schema.mutable(Schema.Array(SupportedChain)).annotate({
    description: "The chains to create the session key for",
  }),
  policyParams: Schema.mutable(Schema.Array(PolicyParams)),
  smartAccountAlias: Schema.String.annotate({
    description: "The alias of the smart account to create the session key for",
  }),
  ownerKeystorePassword: Schema.redact(Schema.String).annotate({
    description: "The password to decrypt the owner keystore with",
  }),
  sessionKeyPassword: Schema.redact(Schema.String).annotate({
    description: "The password to encrypt the session key with",
  }),
});

export const SessionKeyData = Schema.Struct({
  alias: Schema.String,
  data: SessionKey,
  path: Schema.String,
});

export type SessionKey = typeof SessionKey.Type;
export type SessionKeyData = typeof SessionKeyData.Type;
export type CreateSessionKeyParams = typeof CreateSessionKeyParams.Type;
