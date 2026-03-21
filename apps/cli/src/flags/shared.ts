import { Flag } from "effect/unstable/cli";

import { type SupportedChain, supportedChains } from "@/schema/chain";

const chain = Flag.choice(
  "chain",
  Object.keys(supportedChains) as SupportedChain[],
).pipe(Flag.withDescription("Chain Name"), Flag.optional);

const rpcUrl = Flag.string("rpc-url").pipe(
  Flag.withDescription("RPC URL"),
  Flag.optional,
);

export const chainAndRpcUrl = { chain, rpcUrl };
