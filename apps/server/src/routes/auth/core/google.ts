import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { CurrentActor, NameraApi } from "@namera-ai/api";
import { Application, AuthConfig } from "@namera-ai/application";
import { GoogleAuthError } from "@namera-ai/protocol";

import {
  AuthCookieConfig,
  googleBrowserCookieName,
  setAuthCookie,
  setBetaSignupCookie,
  setGoogleBrowserCookie,
} from "#/helpers/auth-cookie";
import { enforceActor } from "#/helpers/index";
import { clientIdentifier, consumeRateLimit, rateLimitPolicy } from "#/rate-limit";

const requireDashboardOrigin = Effect.gen(function* () {
  const config = yield* AuthConfig.pipe(Effect.orDie);
  const request = yield* HttpServerRequest.HttpServerRequest;
  if (request.headers.origin !== config.dashboardPublicOrigin.origin)
    return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
});
const limitGoogle = Effect.gen(function* () {
  yield* consumeRateLimit(
    "google-auth.ip",
    yield* clientIdentifier,
    rateLimitPolicy.magicLink.verifyByIp,
  );
});

export const GoogleRoutes = HttpApiBuilder.group(NameraApi, "google", (handlers) =>
  Effect.gen(function* () {
    const app = yield* Application;
    const config = yield* AuthConfig.pipe(Effect.orDie);
    const cookies = yield* AuthCookieConfig;
    return handlers
      .handle("configuration", () => Effect.succeed({ enabled: app.google.enabled }))
      .handle("start", ({ payload }) =>
        Effect.gen(function* () {
          if (payload.surface === "admin") {
            const request = yield* HttpServerRequest.HttpServerRequest;
            if (
              Option.isNone(config.adminPublicOrigin) ||
              request.headers.origin !== config.adminPublicOrigin.value.origin
            )
              return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
          } else yield* requireDashboardOrigin;
          yield* limitGoogle;
          const started = yield* app.google.start(payload);
          yield* setGoogleBrowserCookie(started.browserToken, cookies.secure);
          return { authorizationUrl: started.authorizationUrl };
        }),
      )
      .handleRaw("callback", () =>
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const query = new URL(request.url, config.apiPublicOrigin).searchParams;
          const result = yield* Effect.gen(function* () {
            yield* limitGoogle;
            return yield* app.google.complete(
              {
                state: query.get("state") ?? "",
                browserToken: request.cookies[googleBrowserCookieName] ?? "",
                ...(query.has("code") ? { code: query.get("code") ?? "" } : {}),
                ...(query.has("error") ? { error: query.get("error") ?? "" } : {}),
                ...(request.cookies["auth-token"]
                  ? { authToken: request.cookies["auth-token"] }
                  : {}),
              },
              {
                ipAddress: Option.getOrNull(request.remoteAddress),
                userAgent: request.headers["user-agent"] ?? null,
              },
            );
          }).pipe(
            Effect.catchTag("GoogleAuthError", (error) =>
              Effect.succeed({
                surface: error.surface,
                returnTo: `${error.surface !== "admin" && request.cookies["auth-token"] ? "/settings/security" : "/auth"}?google=${error.code}`,
              }),
            ),
            Effect.catchTag("RateLimitExceeded", () =>
              Effect.succeed({ returnTo: "/auth?google=GOOGLE_UNAVAILABLE" }),
            ),
          );
          yield* setGoogleBrowserCookie("", cookies.secure);
          if ("sessionToken" in result && result.sessionToken)
            yield* setAuthCookie(result.sessionToken, cookies.secure);
          if ("admissionToken" in result && result.admissionToken)
            yield* setBetaSignupCookie(result.admissionToken, cookies.secure);
          const isAdmin = "surface" in result && result.surface === "admin";
          const origin = isAdmin
            ? Option.getOrElse(config.adminPublicOrigin, () => config.dashboardPublicOrigin)
            : config.dashboardPublicOrigin;
          const returnTo =
            isAdmin && result.returnTo === "/auth/invite" ? "/auth?denied=true" : result.returnTo;
          return HttpServerResponse.redirect(new URL(returnTo, origin).toString()).pipe(
            HttpServerResponse.setHeader("cache-control", "no-store"),
            HttpServerResponse.setHeader("referrer-policy", "no-referrer"),
          );
        }),
      );
  }),
);

export const ConnectedAccountRoutes = HttpApiBuilder.group(
  NameraApi,
  "connectedAccounts",
  (handlers) =>
    Effect.gen(function* () {
      const app = yield* Application;
      const cookies = yield* AuthCookieConfig;
      const human = Effect.gen(function* () {
        return yield* enforceActor({ actor: yield* CurrentActor, allowedActors: ["user"] });
      });
      return handlers
        .handle("list", () =>
          Effect.gen(function* () {
            return yield* app.google.list((yield* human).user.id);
          }),
        )
        .handle("connectGoogle", () =>
          Effect.gen(function* () {
            yield* requireDashboardOrigin;
            yield* limitGoogle;
            const actor = yield* human;
            const started = yield* app.google.start(
              {},
              { userId: actor.user.id, sessionId: actor.session.id },
            );
            yield* setGoogleBrowserCookie(started.browserToken, cookies.secure);
            return { authorizationUrl: started.authorizationUrl };
          }),
        )
        .handle("unlink", ({ params }) =>
          Effect.gen(function* () {
            yield* requireDashboardOrigin;
            yield* limitGoogle;
            const actor = yield* human;
            yield* app.google.unlink(params.accountId, actor.user.id, actor.session.id);
          }),
        );
    }),
);
