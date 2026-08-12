import { Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { User, UserMetadata } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";

export interface UserApplication {
  readonly update: (
    userId: UserId,
    sessionId: SessionId,
    metadata: UserMetadata,
  ) => Effect.Effect<User>;
}

export const makeUserApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const audit = yield* Audit;
  const transaction = yield* TransactionService;

  const update = Effect.fn("Application.user.update")(function* (
    userId: UserId,
    sessionId: SessionId,
    metadata: UserMetadata,
  ) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const updated = yield* repository.auth.user.updateMetadata(userId, metadata);
        if (!updated) return yield* Effect.die("Authenticated user no longer exists");
        yield* audit.user({
          userId,
          sessionId,
          event: "user.updated",
          data: { version: 1, changedFields: ["name", "image"] },
        });
        return updated;
      }),
    );
  }, Effect.orDie);

  return { update } satisfies UserApplication;
});
