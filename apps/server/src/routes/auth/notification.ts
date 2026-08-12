import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/unstable/httpapi";

import { NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceCurrentUser, toNotificationResponse } from "#/helpers/index";

export const NotificationRoutes = HttpApiBuilder.group(NameraApi, "notification", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          const result = yield* app.notification.list({
            userId: actor.user.id,
            ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
          });
          return {
            items: result.items.map(toNotificationResponse),
            nextCursor: result.nextCursor,
          };
        }),
      )
      .handle("unreadCount", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return { count: yield* app.notification.unreadCount(actor.user.id) };
        }),
      )
      .handle("markRead", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          yield* app.notification.markRead(payload.notificationId, actor.user.id);
        }),
      )
      .handle("markAllRead", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return { count: yield* app.notification.markAllRead(actor.user.id) };
        }),
      )
      .handle("archive", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          yield* app.notification.archive(payload.notificationId, actor.user.id);
        }),
      )
      .handle("listPreferences", () =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          return yield* app.notification.listPreferences(actor.user.id);
        }),
      )
      .handle("updatePreference", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          if (payload.organizationId !== null && payload.organizationId !== actor.organization.id) {
            return yield* new HttpApiError.Forbidden();
          }
          return yield* app.notification.updatePreference({
            ...payload,
            userId: actor.user.id,
            sessionId: actor.session.id,
          });
        }),
      )
      .handle("resetPreference", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* enforceCurrentUser();
          if (payload.organizationId !== null && payload.organizationId !== actor.organization.id) {
            return yield* new HttpApiError.Forbidden();
          }
          yield* app.notification.resetPreference({
            ...payload,
            userId: actor.user.id,
            sessionId: actor.session.id,
          });
        }),
      );
  }),
);
