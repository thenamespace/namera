import { Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { OrganizationId, SessionId, UserId } from "@namera-ai/protocol";
import type {
  NotificationCategory,
  NotificationChannel,
  NotificationPreference,
} from "@namera-ai/protocol/model";
import { notificationPreferenceChanges } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";

export interface NotificationPreferenceScope {
  readonly userId: UserId;
  readonly sessionId: SessionId;
  readonly organizationId: OrganizationId | null;
  readonly category: NotificationCategory;
  readonly channel: NotificationChannel;
}

export interface NotificationPreferenceApplication {
  readonly listPreferences: (
    userId: UserId,
  ) => Effect.Effect<ReadonlyArray<NotificationPreference>>;
  readonly updatePreference: (
    input: NotificationPreferenceScope & { readonly enabled: boolean },
  ) => Effect.Effect<NotificationPreference>;
  readonly resetPreference: (input: NotificationPreferenceScope) => Effect.Effect<void>;
}

export const makeNotificationPreferenceApplication = Effect.gen(function* () {
  const audit = yield* Audit;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const listPreferences = Effect.fn("Application.notification.listPreferences")(
    function* (userId: UserId) {
      return yield* repository.notification.preference.listForUser(userId);
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const updatePreference = Effect.fn("Application.notification.updatePreference")(
    function* (input: NotificationPreferenceScope & { readonly enabled: boolean }) {
      const preference = yield* transaction.run(
        Effect.gen(function* () {
          const updated = yield* repository.notification.preference.upsert(input);
          yield* audit.user({
            userId: input.userId,
            sessionId: input.sessionId,
            event: "notification.preference_updated",
            data: {
              version: 1,
              organizationId: input.organizationId,
              category: input.category,
              channel: input.channel,
              enabled: input.enabled,
            },
          });
          return updated;
        }),
      );
      yield* Metric.update(
        Metric.withAttributes(notificationPreferenceChanges, { action: "updated" }),
        1,
      );
      return preference;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const resetPreference = Effect.fn("Application.notification.resetPreference")(
    function* (input: NotificationPreferenceScope) {
      yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.notification.preference.remove(input);
          yield* audit.user({
            userId: input.userId,
            sessionId: input.sessionId,
            event: "notification.preference_updated",
            data: {
              version: 1,
              organizationId: input.organizationId,
              category: input.category,
              channel: input.channel,
              enabled: null,
            },
          });
        }),
      );
      yield* Metric.update(
        Metric.withAttributes(notificationPreferenceChanges, { action: "reset" }),
        1,
      );
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return {
    listPreferences,
    updatePreference,
    resetPreference,
  } satisfies NotificationPreferenceApplication;
});
