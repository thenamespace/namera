import { Clock, Effect, Option } from "effect";
import { HttpEffect, HttpServerRequest } from "effect/http";

import { Repository } from "@namera-ai/database";
import type { CurrentActorResponse } from "@namera-ai/protocol/dto";
import { httpRouteTemplate } from "@namera-ai/telemetry";
import { AnalyticsCollection, analyticsOptedOut } from "@namera-ai/telemetry/analytics/collection";
import { ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

/** Register after authentication; this captures HTTP outcomes, never request or response bodies. */
export const makeProductOperationObserver = Effect.gen(function* () {
  const analytics = yield* Effect.serviceOption(ProductAnalytics);
  const repository = yield* Repository;
  return Effect.fnUntraced(function* (actor: CurrentActorResponse) {
    if (Option.isNone(analytics) || !analytics.value.enabled) return;
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
    if (analyticsOptedOut(request.headers) || (yield* AnalyticsCollection) !== "enabled") return;
    const started = yield* Clock.currentTimeMillis;
    yield* HttpEffect.appendPreResponseHandler((_request, response) =>
      Effect.gen(function* () {
        const observation = {
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
        };
        yield* analytics.value.capture(observation);
        if (response.status === 403)
          yield* analytics.value.capture({ ...observation, event: "operation_denied" });
        if (route === "/executions/simulate")
          yield* analytics.value.capture({ ...observation, event: "simulation_completed" });
        if (
          route.startsWith("/signatures") &&
          route !== "/signatures/verify" &&
          response.status >= 400
        ) {
          yield* analytics.value.capture({ ...observation, event: "signing_failed" });
        }
        // This is a successful authenticated request, not proof of an onchain operation.
        if (
          actor.type !== "user" &&
          response.status >= 200 &&
          response.status < 300 &&
          [
            "/wallets",
            "/wallets/:id",
            "/session-keys",
            "/session-keys/:id",
            "/executions/prepare",
            "/executions/simulate",
            "/signatures",
            "/signatures/prepare",
          ].includes(route)
        ) {
          yield* repository.jobs.analytics
            .enqueue(`first-request:${actor.data.actorId}`, {
              event: "integration_first_request_succeeded",
              distinctId: observation.distinctId,
              properties: { actor_kind: actor.type, workspace_id: actor.data.organizationId },
            })
            .pipe(
              Effect.catchCause(() => Effect.logWarning("analytics.first_request.enqueue_failed")),
            );
        }
        return response;
      }),
    );
  });
});
