import { DateTime, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import type { Email } from "@namera-ai/protocol";
import type { ListWaitlistRequest } from "@namera-ai/protocol/dto";
import { betaInviteTransitions, waitlistAcceptances, waitlistJoins } from "@namera-ai/telemetry";

import { makeIssueBetaInvite } from "./issue-beta-invite.js";
import { requirePlatformPermission, type PlatformSession } from "./platform/access.js";

export const makeWaitlistApplication = Effect.gen(function* () {
  const repositories = yield* Repository;
  const repository = repositories.auth.waitlist;
  const transaction = yield* TransactionService;
  const emails = yield* EmailJobs;
  const issue = yield* makeIssueBetaInvite;

  const join = Effect.fn("application.waitlist.join")(function* (email: Email) {
    const created = yield* repository.join(email);
    if (created) yield* Metric.update(waitlistJoins, 1);
    return { accepted: true as const };
  }, Effect.orDie);

  const list = Effect.fn("application.waitlist.list")(
    function* (context: PlatformSession, input: ListWaitlistRequest) {
      yield* requirePlatformPermission(repositories, context, "waitlist:read");
      const limit = input.limit ?? 25;
      const rows = yield* repository.list({
        ...input,
        limit,
        ...(input.email === undefined ? {} : { email: input.email.trim().toLowerCase() }),
      });
      const entries = rows.slice(0, limit);
      return { entries, nextCursor: rows.length > limit ? (entries.at(-1)?.id ?? null) : null };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const accept = Effect.fn("application.waitlist.accept")(
    function* (context: PlatformSession, id: string) {
      const result = yield* transaction.run(
        Effect.gen(function* () {
          yield* repositories.auth.platform.lockTeam();
          const actor = yield* requirePlatformPermission(repositories, context, "waitlist:accept");
          const now = yield* DateTime.now;
          // Claim the pending transition atomically; an enqueue failure rolls it back with the invite.
          const entry = yield* repository.completePending(id, now);
          if (!entry) return { accepted: false };
          const invite = yield* issue({
            actorMemberId: actor.id,
            email: entry.email,
            createdAt: now,
            expiresAt: DateTime.add(now, { days: 7 }),
          });
          yield* emails.enqueue({
            type: "waitlist-accepted",
            to: entry.email,
            idempotencyKey: `waitlist-accepted:${entry.id}`,
            expiresAt: invite.expiresAt,
            variables: {
              inviteCode: invite.code,
              invitationUrl: invite.url,
              expiresAt: DateTime.formatIso(invite.expiresAt),
            },
          });
          yield* repository.appendAcceptance(entry.id);
          yield* repositories.auth.platform.appendEvent(actor.id, {
            version: 1,
            type: "waitlist.accepted",
            waitlistId: entry.id,
            inviteId: invite.id,
          });
          return { accepted: true };
        }),
      );
      if (result.accepted) {
        yield* Metric.update(waitlistAcceptances, 1);
        yield* Metric.update(
          Metric.withAttributes(betaInviteTransitions, { result: "created" }),
          1,
        );
      }
      return result;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return { join, list, accept };
});
