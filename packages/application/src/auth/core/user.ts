import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { UserId } from "@namera-ai/protocol";
import type { User, UserMetadata } from "@namera-ai/protocol/model";

export interface UserApplication {
  readonly update: (userId: UserId, metadata: UserMetadata) => Effect.Effect<User>;
}

export const makeUserApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const update = Effect.fn("Application.user.update")(function* (
    userId: UserId,
    metadata: UserMetadata,
  ) {
    const updated = yield* repository.auth.user.updateMetadata(userId, metadata);
    if (!updated) return yield* Effect.die("Authenticated user no longer exists");
    return updated;
  }, Effect.orDie);

  return { update } satisfies UserApplication;
});
