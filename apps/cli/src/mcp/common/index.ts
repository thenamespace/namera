import { Schema } from "effect";
import { baseSepolia, type Chain, sepolia } from "viem/chains";

export const EmptyArgs = Schema.Record(Schema.String, Schema.Unknown);

export class InsufficientPermissions extends Schema.TaggedErrorClass<InsufficientPermissions>()(
  "InsufficientPermissions",
  {},
) {}

export const SupportedChain = Schema.Literals(["sepolia"]);
export type SupportedChain = typeof SupportedChain.Type;

export const getChain = (chain: SupportedChain): Chain => {
  if (chain === "sepolia") return sepolia;
  return baseSepolia;
};
