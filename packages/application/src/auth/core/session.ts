import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { Session } from "@namera-ai/protocol/model";
import { sessionLifecycleEvents } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

export interface SessionApplication {
  readonly list: (userId: UserId) => Effect.Effect<ReadonlyArray<Session>>;
  readonly logout: (sessionId: SessionId, userId: UserId) => Effect.Effect<void>;
  readonly revoke: (input: {
    readonly sessionId: SessionId;
    readonly currentSessionId: SessionId;
    readonly userId: UserId;
  }) => Effect.Effect<boolean>;
  readonly revokeOthers: (sessionId: SessionId, userId: UserId) => Effect.Effect<number>;
}

export const makeSessionApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const audit = yield* Audit;
  const transaction = yield* TransactionService;

  const list = Effect.fn("application.session.list")(function* (userId: UserId) {
    return yield* repository.auth.session.findActiveForUser(userId, yield* DateTime.now);
  }, Effect.orDie);

  const logout = Effect.fn("application.session.logout")(function* (
    sessionId: SessionId,
    userId: UserId,
  ) {
    const revoked = yield* transaction.run(
      Effect.gen(function* () {
        const session = yield* repository.auth.session.revoke(
          sessionId,
          userId,
          yield* DateTime.now,
        );
        if (session) {
          yield* audit.user({
            userId,
            sessionId,
            event: "session.revoked",
            data: { version: 1, sessionId },
          });
        }
        return session !== undefined;
      }),
    );
    if (revoked) {
      yield* Metric.update(sessionLifecycleEvents, "revoked");
      yield* Effect.logInfo("session.revoked").pipe(Effect.annotateLogs({ scope: "current" }));
    }
  }, Effect.orDie);

  const revokeOthers = Effect.fn("application.session.revokeOthers")(function* (
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
        if (revoked > 0) {
          yield* audit.user({
            userId,
            sessionId,
            event: "session.others_revoked",
            data: { version: 1, count: revoked },
          });
        }
        return revoked;
      }),
    );
    if (count > 0) {
      yield* Metric.update(sessionLifecycleEvents, "others_revoked");
      yield* Effect.logInfo("session.revoked").pipe(Effect.annotateLogs({ scope: "other", count }));
    }
    return count;
  }, Effect.orDie);

  const revoke = Effect.fn("application.session.revoke")(function* (input: {
    readonly sessionId: SessionId;
    readonly currentSessionId: SessionId;
    readonly userId: UserId;
  }) {
    const revoked = yield* transaction.run(
      Effect.gen(function* () {
        const session = yield* repository.auth.session.revoke(
          input.sessionId,
          input.userId,
          yield* DateTime.now,
        );
        if (session === undefined) return false;
        yield* audit.user({
          userId: input.userId,
          sessionId: input.currentSessionId,
          event: "session.revoked",
          data: { version: 1, sessionId: input.sessionId },
        });
        return true;
      }),
    );
    if (revoked) {
      yield* Metric.update(sessionLifecycleEvents, "selected_revoked");
      yield* Effect.logInfo("session.revoked").pipe(Effect.annotateLogs({ scope: "selected" }));
    }
    return revoked;
  }, Effect.orDie);

  return { list, logout, revoke, revokeOthers } satisfies SessionApplication;
});
