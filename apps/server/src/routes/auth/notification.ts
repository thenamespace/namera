import { Effect } from "effect";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import * as Application from "@namera-ai/application";

import { enforceActor, toNotificationResponse } from "#/helpers/index";

export const NotificationRoutes = HttpApiBuilder.group(NameraApi, "notification", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application.Application;

    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          const result = yield* app.notification.list({
            userId: data.user.id,
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
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return { count: yield* app.notification.unreadCount(data.user.id) };
        }),
      )
      .handle("markRead", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* app.notification.markRead(payload.notificationId, data.user.id);
        }),
      )
      .handle("markAllRead", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return { count: yield* app.notification.markAllRead(data.user.id) };
        }),
      )
      .handle("archive", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          yield* app.notification.archive(payload.notificationId, data.user.id);
        }),
      )
      .handle("listPreferences", () =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          return yield* app.notification.listPreferences(data.user.id);
        }),
      )
      .handle("updatePreference", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          if (payload.organizationId !== null && payload.organizationId !== data.organization.id) {
            return yield* new HttpApiError.Forbidden();
          }
          return yield* app.notification.updatePreference({
            ...payload,
            userId: data.user.id,
            sessionId: data.session.id,
          });
        }),
      )
      .handle("resetPreference", ({ payload }) =>
        Effect.gen(function* () {
          const actor = yield* CurrentActor;
          const data = yield* enforceActor({ actor, allowedActors: ["user"] });
          if (payload.organizationId !== null && payload.organizationId !== data.organization.id) {
            return yield* new HttpApiError.Forbidden();
          }
          yield* app.notification.resetPreference({
            ...payload,
            userId: data.user.id,
            sessionId: data.session.id,
          });
        }),
      );
  }),
);
