import type { GasPolicyParams } from "@namera-ai/core/policy";
import { Effect } from "effect";
import { parseEther } from "viem";

import { etherPrompt } from "./common";

export const getGasPolicyParams = Effect.gen(function* () {
  const allowed = yield* etherPrompt(
    "Total amount of gas allowed (in ETH units)",
  );

  const weiUnits = parseEther(allowed);

  return {
    allowed: weiUnits,
    type: "gas",
  } satisfies GasPolicyParams & {
    type: "gas";
  };
});
