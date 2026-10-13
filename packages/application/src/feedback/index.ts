import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import {
  FeedbackNotFoundError,
  type OrganizationId,
  type SessionId,
  type UserId,
} from "@namera-ai/protocol";
import type { CreateFeedbackRequest, ListFeedbackRequest } from "@namera-ai/protocol/dto";
import type { FeedbackStatus } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { requirePlatformPermission, type PlatformSession } from "#/auth/platform/access";

export const makeFeedbackApplication = Effect.gen(function* () {
  const repositories = yield* Repository;
  const repository = repositories.core.feedback;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;

  const create = Effect.fn("application.feedback.create")(
    function* (
      input: CreateFeedbackRequest & {
        readonly userId: UserId;
        readonly organizationId: OrganizationId;
        readonly sessionId: SessionId;
      },
    ) {
      return yield* transaction.run(
        Effect.gen(function* () {
          const { sessionId, ...submission } = input;
          const entry = yield* repository.create(submission);
          yield* audit.user({
            userId: input.userId,
            sessionId,
            event: "feedback.created",
            data: { version: 1, feedbackId: entry.id },
          });
          return { id: entry.id };
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  const list = Effect.fn("application.feedback.list")(
    function* (context: PlatformSession, input: ListFeedbackRequest) {
      yield* requirePlatformPermission(repositories, context, "feedback:read");
      const limit = input.limit ?? 25;
      const rows = yield* repository.list({ ...input, limit });
      const entries = rows.slice(0, limit);
      return { entries, nextCursor: rows.length > limit ? (entries.at(-1)?.id ?? null) : null };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  const get = Effect.fn("application.feedback.get")(
    function* (context: PlatformSession, id: string) {
      yield* requirePlatformPermission(repositories, context, "feedback:read");
      const entry = yield* repository.get(id);
      if (!entry) return yield* new FeedbackNotFoundError({ id });
      return entry;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  const updateStatus = Effect.fn("application.feedback.updateStatus")(
    function* (context: PlatformSession, id: string, status: FeedbackStatus) {
      return yield* transaction.run(
        Effect.gen(function* () {
          // Serialize with membership changes so a revoked owner cannot complete a queued write.
          yield* repositories.auth.platform.lockTeam();
          const actor = yield* requirePlatformPermission(repositories, context, "feedback:manage");
          const entry = yield* repository.get(id);
          if (!entry) return yield* new FeedbackNotFoundError({ id });
          if (entry.status === status) return entry;
          const now = yield* DateTime.now;
          yield* repository.updateStatus(id, status, now);
          yield* repositories.auth.platform.appendEvent(actor.id, {
            version: 1,
            type: "feedback.status-changed",
            feedbackId: id,
            previousStatus: entry.status,
            status,
          });
          return { ...entry, status, updatedAt: now };
        }),
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return { create, list, get, updateStatus };
});
