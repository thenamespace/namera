import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import { HttpApiBuilder, HttpApiError } from "effect/http-api";

import { CurrentActor, CurrentAdmin, NameraApi } from "@namera-ai/api";
import { Application, AuthConfig } from "@namera-ai/application";

import { enforceActor } from "#/helpers/index";
import { consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

export const FeedbackRoutes = HttpApiBuilder.group(NameraApi, "feedback", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    const config = yield* AuthConfig;
    return handlers.handle("create", ({ payload }) =>
      Effect.gen(function* () {
        const actor = yield* enforceActor({ actor: yield* CurrentActor, allowedActors: ["user"] });
        const request = yield* HttpServerRequest.HttpServerRequest;
        if (request.headers.origin !== config.dashboardPublicOrigin.origin)
          return yield* new HttpApiError.Forbidden();
        yield* consumeRateLimit("feedback.create", actor.user.id, rateLimitPolicy.feedback.byUser);
        return yield* app.feedback.create({
          ...payload,
          userId: actor.user.id,
          organizationId: actor.organization.id,
          sessionId: actor.session.id,
        });
      }),
    );
  }),
);

export const AdminFeedbackRoutes = HttpApiBuilder.group(NameraApi, "adminFeedback", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    return handlers
      .handle("list", ({ query }) =>
        Effect.gen(function* () {
          return yield* app.feedback.list(yield* CurrentAdmin, query);
        }),
      )
      .handle("get", ({ params }) =>
        Effect.gen(function* () {
          return yield* app.feedback.get(yield* CurrentAdmin, params.id);
        }),
      )
      .handle("updateStatus", ({ params, payload }) =>
        Effect.gen(function* () {
          const admin = yield* CurrentAdmin;
          yield* consumeRateLimit(
            "admin.feedback.write",
            admin.member.id,
            rateLimitPolicy.admin.writesGlobal,
          );
          return yield* app.feedback.updateStatus(admin, params.id, payload.status);
        }),
      );
  }),
);
