import { Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { User, UserMetadata } from "@namera-ai/protocol/model";
import { userProfileUpdates } from "@namera-ai/telemetry";

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

  const update = Effect.fn("application.user.update")(function* (
    userId: UserId,
    sessionId: SessionId,
    metadata: UserMetadata,
  ) {
    const result = yield* transaction.run(
      Effect.gen(function* () {
        const current = yield* repository.auth.user.findById(userId);
        if (!current) return yield* Effect.die("Authenticated user no longer exists");
        const changedFields: Array<"name" | "image"> = [];
        if (current.metadata.name !== metadata.name) changedFields.push("name");
        if (current.metadata.image !== metadata.image) changedFields.push("image");
        if (changedFields.length === 0) return { user: current, changed: false } as const;

        const updated = yield* repository.auth.user.updateMetadata(userId, metadata);
        if (!updated) return yield* Effect.die("Authenticated user no longer exists");
        yield* audit.user({
          userId,
          sessionId,
          event: "user.updated",
          data: { version: 1, changedFields },
        });
        return { user: updated, changed: true } as const;
      }),
    );
    if (result.changed) {
      yield* Metric.update(userProfileUpdates, 1);
      yield* Effect.logInfo("user.updated");
    }
    return result.user;
  }, Effect.orDie);

  return { update } satisfies UserApplication;
});
