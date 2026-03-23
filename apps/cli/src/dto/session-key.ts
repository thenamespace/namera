import { Schema, Struct } from "effect";

import { EthereumAddress, PolicyParams, SupportedChain } from "@/schema";

import { Keystore } from "./keystore";

export const SessionKey = Schema.Struct({
  smartAccountAlias: Schema.String,
  sessionKeyAddress: EthereumAddress,
  serializedAccounts: Schema.Array(
    Schema.Struct({
      chain: SupportedChain,
      serializedAccount: Schema.String,
    }),
  ),
}).mapFields(Struct.assign(Keystore.fields));

export const SessionKeyData = Schema.Struct({
  alias: Schema.String,
  data: SessionKey,
  path: Schema.String,
});

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

export const GetSessionKeyParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the session key to retrieve",
  }),
});

export const ListSessionKeysParams = Schema.Struct({
  smartAccount: Schema.optional(Schema.String).annotate({
    description: "The alias of the smart account to list session keys for",
  }),
});

export const GetSessionKeyInfoParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the session key to retrieve",
  }),
});

export const GetSessionKeyStatusParams = Schema.Struct({
  alias: Schema.String.annotate({
    description: "The alias of the session key to retrieve",
  }),
  chain: SupportedChain.annotate({
    description: "The chain to retrieve the session key status for",
  }),
  rpcUrl: Schema.redact(Schema.String.pipe(Schema.optional)).annotate({
    description: "The RPC URL to use for the chain",
    default: "Public RPC URL",
  }),
});

export type SessionKey = typeof SessionKey.Type;
export type SessionKeyData = typeof SessionKeyData.Type;
export type CreateSessionKeyParams = typeof CreateSessionKeyParams.Type;
export type GetSessionKeyParams = typeof GetSessionKeyParams.Type;
export type ListSessionKeysParams = typeof ListSessionKeysParams.Type;
export type GetSessionKeyInfoParams = typeof GetSessionKeyInfoParams.Type;
export type GetSessionKeyStatusParams = typeof GetSessionKeyStatusParams.Type;
