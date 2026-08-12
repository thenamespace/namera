import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { Session } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";

export interface SessionApplication {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<Session>>;
  readonly logout: (sessionId: SessionId, userId: UserId) => Effect.Effect<void>;
  readonly revokeOthers: (sessionId: SessionId, userId: UserId) => Effect.Effect<number>;
}

export const makeSessionApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const audit = yield* Audit;
  const transaction = yield* TransactionService;

  const list = Effect.fn("Application.session.list")(function* (userId: UserId) {
    return yield* repository.auth.session.findActiveForUser(userId, yield* DateTime.now);
  }, Effect.orDie);

  const logout = Effect.fn("Application.session.logout")(function* (
    sessionId: SessionId,
    userId: UserId,
  ) {
    yield* transaction.run(
      Effect.gen(function* () {
        const revoked = yield* repository.auth.session.revoke(
          sessionId,
          userId,
          yield* DateTime.now,
        );
        if (revoked) {
          yield* audit.user({
            userId,
            sessionId,
            event: "session.revoked",
            data: { version: 1, sessionId },
          });
        }
      }),
    );
    yield* Effect.logInfo("session.revoked", { scope: "current" });
  }, Effect.orDie);

  const revokeOthers = Effect.fn("Application.session.revokeOthers")(function* (
    sessionId: SessionId,
    userId: UserId,
  ) {
    const count = yield* transaction.run(
      Effect.gen(function* () {
        const revoked = yield* repository.auth.session.revokeOthers(
          userId,
          sessionId,
          yield* DateTime.now,
        );
        yield* audit.user({
          userId,
          sessionId,
          event: "session.others_revoked",
          data: { version: 1, count: revoked },
        });
        return revoked;
      }),
    );
    yield* Effect.logInfo("session.revoked", { scope: "other", count });
    return count;
  }, Effect.orDie);

  return { list, logout, revokeOthers } satisfies SessionApplication;
});
