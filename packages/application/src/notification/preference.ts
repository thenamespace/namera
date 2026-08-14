import { Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { SessionId, UserId } from "@namera-ai/protocol";
import type {
  NotificationPreference,
  NotificationPreferenceScope,
  NotificationPreferenceTarget,
} from "@namera-ai/protocol/model";
import { notificationPreferenceChanges } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

type NotificationPreferenceApplicationScope = NotificationPreferenceScope & {
  readonly sessionId: SessionId;
};

export interface NotificationPreferenceApplication {
  readonly listPreferences: (
    userId: UserId,
  ) => Effect.Effect<ReadonlyArray<NotificationPreference>>;
  readonly updatePreference: (
    input: NotificationPreferenceApplicationScope & { readonly enabled: boolean },
  ) => Effect.Effect<NotificationPreference>;
  readonly resetPreference: (input: NotificationPreferenceApplicationScope) => Effect.Effect<void>;
}

export const makeNotificationPreferenceApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const listPreferences = Effect.fn("application.notification.listPreferences")(
    function* (userId: UserId) {
      return yield* repository.notification.preference.listForUser(userId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const updatePreference = Effect.fn("application.notification.updatePreference")(
    function* (input: NotificationPreferenceApplicationScope & { readonly enabled: boolean }) {
      const target: NotificationPreferenceTarget = input;
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const current = yield* repository.notification.preference.findForScope(input);
          if (current?.enabled === input.enabled) {
            return { preference: current, changed: false } as const;
          }
          const updated = yield* repository.notification.preference.upsert(input);
          yield* audit.user({
            userId: input.userId,
            sessionId: input.sessionId,
            event: "notification.preference_updated",
            data: {
              ...target,
              version: 2,
              organizationId: input.organizationId,
              channel: input.channel,
              enabled: input.enabled,
            },
          });
          return { preference: updated, changed: true } as const;
        }),
      );
      if (result.changed) {
        yield* Metric.update(
          Metric.withAttributes(notificationPreferenceChanges, { action: "updated" }),
          1,
        );
        yield* Effect.logInfo("notification.preference_updated").pipe(
          Effect.annotateLogs({
            category: input.category,
            topic: input.topic,
            channel: input.channel,
            scope: input.organizationId === null ? "global" : "organization",
          }),
        );
      }
      return result.preference;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const resetPreference = Effect.fn("application.notification.resetPreference")(
    function* (input: NotificationPreferenceApplicationScope) {
      const target: NotificationPreferenceTarget = input;
      const removed = yield* transaction.run(
        Effect.gen(function* () {
          const preference = yield* repository.notification.preference.remove(input);
          if (preference === undefined) return false;
          yield* audit.user({
            userId: input.userId,
            sessionId: input.sessionId,
            event: "notification.preference_updated",
            data: {
              ...target,
              version: 2,
              organizationId: input.organizationId,
              channel: input.channel,
              enabled: null,
            },
          });
          return true;
        }),
      );
      if (removed) {
        yield* Metric.update(
          Metric.withAttributes(notificationPreferenceChanges, { action: "reset" }),
          1,
        );
        yield* Effect.logInfo("notification.preference_reset").pipe(
          Effect.annotateLogs({
            category: input.category,
            topic: input.topic,
            channel: input.channel,
            scope: input.organizationId === null ? "global" : "organization",
          }),
        );
      }
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return {
    listPreferences,
    updatePreference,
    resetPreference,
  } satisfies NotificationPreferenceApplication;
});
