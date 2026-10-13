import { Effect } from "effect";

import { makeCompleteWalletSignature } from "./complete.js";
import { makePrepareWalletSignature } from "./prepare.js";

export const makeWalletSignatures = Effect.gen(function* () {
  return {
    prepare: yield* makePrepareWalletSignature,
    complete: yield* makeCompleteWalletSignature,
  };
});
