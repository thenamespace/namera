import { Clock, Effect, Option } from "effect";
import { HttpEffect, HttpServerRequest } from "effect/http";

import type { CurrentActorResponse } from "@namera-ai/protocol/dto";
import { httpRouteTemplate } from "@namera-ai/telemetry";
import { ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

/** Register after authentication; this captures HTTP outcomes, never request or response bodies. */
export const observeProductOperation = Effect.fnUntraced(function* (actor: CurrentActorResponse) {
  const analytics = yield* Effect.serviceOption(ProductAnalytics);
  if (Option.isNone(analytics)) return;
  const request = yield* HttpServerRequest.HttpServerRequest;
  const route = httpRouteTemplate(request.url);
  if (
    route === "/*" ||
    route.startsWith("/internal") ||
    route === "/auth/session/me" ||
    route === "/auth/session/actor"
  )
    return;
  // Browser choices also apply to the authenticated API request. Machine callers can use DNT.
  if (
    request.headers.dnt === "1" ||
    request.headers["sec-gpc"] === "1" ||
    (request.headers.cookie ?? "").split(/;\s*/).includes("namera_analytics_disabled=true")
  )
    return;
  const started = yield* Clock.currentTimeMillis;
  yield* HttpEffect.appendPreResponseHandler((_request, response) =>
    Effect.gen(function* () {
      yield* analytics.value.capture({
        distinctId:
          actor.type === "user" ? actor.data.user.id : `${actor.type}:${actor.data.actorId}`,
        properties: {
          action: route,
          method: request.method,
          status_code: response.status,
          outcome: response.status < 400 ? "success" : "failure",
          actor_kind: actor.type,
          duration_ms: (yield* Clock.currentTimeMillis) - started,
          workspace_id:
            actor.type === "user" ? actor.data.organization.id : actor.data.organizationId,
          ...(actor.type === "user"
            ? { workspace_name: actor.data.organization.metadata.name }
            : {}),
        },
      });
      return response;
    }),
  );
});
