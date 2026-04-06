import { Effect, Option } from "effect";

import { Database } from "./layer";
import { TransactionClient } from "./transaction";

export const TransactionOrDatabase = Effect.gen(function* () {
  const tx = yield* Effect.serviceOption(TransactionClient);
  if (Option.isSome(tx)) {
    return tx.value;
  }

  return yield* Database;
});
