import { Schema } from "effect";

export const OneClawSecp256k1Chain = Schema.Literals(["ethereum", "bitcoin", "tron"]);
export const OneClawEd25519Chain = Schema.Literals(["solana", "xrp", "cardano"]);
export const OneClawChain = Schema.Union([OneClawSecp256k1Chain, OneClawEd25519Chain]);

const OneClawKeyFields = {
  version: Schema.Literal(1),
  type: Schema.Literal("1claw"),
  agentId: Schema.NonEmptyString,
  providerKeyId: Schema.NonEmptyString,
  keyVersion: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
};

export const OneClawSecp256k1KeyData = Schema.Struct({
  ...OneClawKeyFields,
  chain: OneClawSecp256k1Chain,
});

export const OneClawEd25519KeyData = Schema.Struct({
  ...OneClawKeyFields,
  chain: OneClawEd25519Chain,
});

export const OneClawSigningKeyData = Schema.Union([OneClawSecp256k1KeyData, OneClawEd25519KeyData]);

// Metadata can describe other chain families without promising their signing
// capabilities. The accounts-first provider contract accepts Ethereum only.
export const OneClawEthereumKeyData = Schema.Struct({
  ...OneClawKeyFields,
  chain: Schema.Literal("ethereum"),
});

export type OneClawChain = typeof OneClawChain.Type;
export type OneClawSigningKeyData = typeof OneClawSigningKeyData.Type;
export type OneClawEthereumKeyData = typeof OneClawEthereumKeyData.Type;
