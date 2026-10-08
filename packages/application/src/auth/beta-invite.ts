import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { CreateBetaInvitesRequest, ListBetaInvitesRequest } from "@namera-ai/protocol/dto";
import { betaInviteTransitions } from "@namera-ai/telemetry";

import { makeIssueBetaInvite } from "./issue-beta-invite.js";
import { requirePlatformPermission, type PlatformSession } from "./platform/access.js";

export const makeBetaInviteApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const issue = yield* makeIssueBetaInvite;
  const create = Effect.fn("application.betaInvite.create")(
    function* (context: PlatformSession, input: CreateBetaInvitesRequest) {
      const createdAt = yield* DateTime.now;
      const expiresAt = DateTime.add(createdAt, { days: input.expiresInDays ?? 7 });
      const result = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.auth.platform.lockTeam();
          const actor = yield* requirePlatformPermission(repository, context, "invites:manage");
          const actorMemberId = actor.id;
          const invites = [];
          for (let index = 0; index < input.count; index++) {
            invites.push(
              yield* issue({ actorMemberId, email: input.email ?? null, createdAt, expiresAt }),
            );
          }
          return { invites };
        }),
      );
      yield* Metric.update(
        Metric.withAttributes(betaInviteTransitions, { result: "created" }),
        result.invites.length,
      );
      return result;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  const revoke = Effect.fn("application.betaInvite.revoke")(
    function* (context: PlatformSession, id: string) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.auth.platform.lockTeam();
          const actor = yield* requirePlatformPermission(repository, context, "invites:manage");
          const actorMemberId = actor.id;
          const revoked = yield* repository.auth.betaInvite.revoke(id, yield* DateTime.now);
          if (revoked) yield* repository.auth.betaInvite.appendEvent(id, "revoked");
          if (revoked)
            yield* repository.auth.platform.appendEvent(actorMemberId, {
              version: 1,
              type: "beta-invite.revoked",
              inviteId: id,
            });
          return { revoked: revoked !== undefined };
        }),
      );
      if (result.revoked)
        yield* Metric.update(
          Metric.withAttributes(betaInviteTransitions, { result: "revoked" }),
          1,
        );
      return result;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  const list = Effect.fn("application.betaInvite.list")(
    function* (context: PlatformSession, input: ListBetaInvitesRequest) {
      yield* requirePlatformPermission(repository, context, "invites:read");
      const limit = input.limit ?? 50;
      const rows = yield* repository.auth.betaInvite.list({
        ...input,
        limit,
        now: yield* DateTime.now,
        ...(input.email === undefined ? {} : { email: input.email.trim().toLowerCase() }),
      });
      const entries = rows.slice(0, limit);
      return { entries, nextCursor: rows.length > limit ? (entries.at(-1)?.id ?? null) : null };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return { create, list, revoke };
});
