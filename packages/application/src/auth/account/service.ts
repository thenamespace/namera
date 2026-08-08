import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { Session, User, UserMetadata } from "@namera-ai/protocol/model";

export interface SessionApplication {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<Session>>;
  readonly logout: (sessionId: SessionId, userId: UserId) => Effect.Effect<void>;
  readonly revokeOthers: (sessionId: SessionId, userId: UserId) => Effect.Effect<number>;
}

export interface UserApplication {
  readonly update: (userId: UserId, metadata: UserMetadata) => Effect.Effect<User>;
}

export const makeAccountApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const list = Effect.fn("Application.session.list")(function* (userId: UserId) {
    return yield* repository.auth.session.findActiveForUser(userId, yield* DateTime.now);
  }, Effect.orDie);

  const logout = Effect.fn("Application.session.logout")(function* (
    sessionId: SessionId,
    userId: UserId,
  ) {
    yield* repository.auth.session.revoke(sessionId, userId, yield* DateTime.now);
    yield* Effect.logInfo("session.revoked", { scope: "current" });
  }, Effect.orDie);

  const revokeOthers = Effect.fn("Application.session.revokeOthers")(function* (
    sessionId: SessionId,
    userId: UserId,
  ) {
    const count = yield* repository.auth.session.revokeOthers(
      userId,
      sessionId,
      yield* DateTime.now,
    );
    yield* Effect.logInfo("session.revoked", { scope: "other", count });
    return count;
  }, Effect.orDie);

  const update = Effect.fn("Application.user.update")(function* (
    userId: UserId,
    metadata: UserMetadata,
  ) {
    const updated = yield* repository.auth.user.updateMetadata(userId, metadata);
    if (!updated) return yield* Effect.die("Authenticated user no longer exists");
    return updated;
  }, Effect.orDie);

  return {
    session: { list, logout, revokeOthers } satisfies SessionApplication,
    user: { update } satisfies UserApplication,
  };
});
