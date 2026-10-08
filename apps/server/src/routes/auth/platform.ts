import { Effect, Layer } from "effect";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentAdmin, CurrentPlatformSession, NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";

import { AuthCookieConfig, clearAuthCookie } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const writer = Effect.gen(function* () {
  const admin = yield* CurrentAdmin;
  yield* consumeRateLimit("admin.team.write", admin.member.id, rateLimitPolicy.admin.writesGlobal);
  return admin;
});

export const PlatformRoutes = Layer.mergeAll(
  HttpApiBuilder.group(NameraApi, "platformSession", (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      const cookieConfig = yield* AuthCookieConfig;
      return handlers.handle("logout", () =>
        Effect.gen(function* () {
          const context = yield* CurrentPlatformSession;
          yield* app.session.logout(context.sessionId, context.userId);
          yield* clearAuthCookie(cookieConfig.secure);
        }),
      );
    }),
  ),
  HttpApiBuilder.group(NameraApi, "platform", (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      return handlers
        .handle("me", () =>
          Effect.gen(function* () {
            return yield* app.platform.me(yield* CurrentAdmin);
          }),
        )
        .handle("members", () =>
          Effect.gen(function* () {
            return yield* app.platform.members(yield* CurrentAdmin);
          }),
        )
        .handle("invitations", ({ query }) =>
          Effect.gen(function* () {
            return yield* app.platform.invitations(yield* CurrentAdmin, query.cursor);
          }),
        )
        .handle("invite", ({ payload }) =>
          Effect.gen(function* () {
            return yield* app.platform.invite(yield* writer, payload);
          }),
        )
        .handle("revokeInvitation", ({ params }) =>
          Effect.gen(function* () {
            return yield* app.platform.revokeInvitation(yield* writer, params.id);
          }),
        )
        .handle("changeRole", ({ params, payload }) =>
          Effect.gen(function* () {
            return yield* app.platform.changeMember(yield* writer, params.id, payload);
          }),
        )
        .handle("changeStatus", ({ params, payload }) =>
          Effect.gen(function* () {
            return yield* app.platform.changeMember(yield* writer, params.id, payload);
          }),
        )
        .handle("removeMember", ({ params }) =>
          Effect.gen(function* () {
            return yield* app.platform.changeMember(yield* writer, params.id, {
              status: "removed",
            });
          }),
        )
        .handle("transferOwnership", ({ payload }) =>
          Effect.gen(function* () {
            return yield* app.platform.transfer(yield* writer, payload.memberId);
          }),
        );
    }),
  ),
  HttpApiBuilder.group(NameraApi, "platformInvitation", (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      return handlers.handle("accept", ({ payload }) =>
        Effect.gen(function* () {
          const context = yield* CurrentPlatformSession;
          yield* consumeRateLimit(
            "admin.invitation.accept",
            context.userId,
            rateLimitPolicy.admin.writesGlobal,
          );
          return yield* app.platform.accept(context, payload.token);
        }),
      );
    }),
  ),
);
