import { Context, DateTime, Effect, Layer } from "effect";

import { Repository } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type { Session, User, UserMetadata } from "@namera-ai/protocol/model";

export interface AccountServiceValue {
  readonly listSessions: (userId: UserId) => Effect.Effect<ReadonlyArray<Session>>;
  readonly logout: (sessionId: SessionId, userId: UserId) => Effect.Effect<void>;
  readonly revokeOtherSessions: (sessionId: SessionId, userId: UserId) => Effect.Effect<number>;
  readonly updateUser: (userId: UserId, metadata: UserMetadata) => Effect.Effect<User>;
}

export class AccountService extends Context.Service<AccountService, AccountServiceValue>()(
  "@namera-ai/application/AccountService",
) {
  static readonly layer = Layer.effect(
    AccountService,
    Effect.gen(function* () {
      const repository = yield* Repository;

      const listSessions = Effect.fn("AccountService.listSessions")(function* (userId: UserId) {
        return yield* repository.auth.session.findActiveForUser(userId, yield* DateTime.now);
      }, Effect.orDie);

      const logout = Effect.fn("AccountService.logout")(function* (
        sessionId: SessionId,
        userId: UserId,
      ) {
        yield* repository.auth.session.revoke(sessionId, userId, yield* DateTime.now);
        yield* Effect.logInfo("session.revoked", { scope: "current" });
      }, Effect.orDie);

      const revokeOtherSessions = Effect.fn("AccountService.revokeOtherSessions")(function* (
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

      const updateUser = Effect.fn("AccountService.updateUser")(function* (
        userId: UserId,
        metadata: UserMetadata,
      ) {
        const updated = yield* repository.auth.user.updateMetadata(userId, metadata);
        if (!updated) return yield* Effect.die("Authenticated user no longer exists");
        return updated;
      }, Effect.orDie);

      return AccountService.of({ listSessions, logout, revokeOtherSessions, updateUser });
    }),
  );
}
