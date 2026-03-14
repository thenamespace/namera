import { Effect } from "effect";
import { parseEther } from "viem";

import { maxLimitPrompt } from "./call";
import type { GasPolicyData } from "./types";

export const getGasPolicyParams = Effect.gen(function* () {
  const allowed = yield* maxLimitPrompt(
    "Total amount of gas allowed (in ETH units)",
  );

  const weiUnits = parseEther(allowed).toString();

  return { data: { allowed: weiUnits }, type: "gas" } satisfies GasPolicyData;
});
