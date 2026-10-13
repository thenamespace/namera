import { expect, layer } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";

import { CorsMiddleware } from "#/middlewares/cors";

import {
  createSession,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../../../fixtures/index.js";
import { makeTestConfigLayer } from "../../../fixtures/layers/config.js";
import { TestServerLayer } from "../../../fixtures/layers/index.js";

const send = Effect.fnUntraced(function* (request: Request) {
  const handler = yield* HttpRouter.toHttpEffect(
    Layer.merge(
      HttpApiBuilder.layer(NameraApi),
      CorsMiddleware.pipe(
        Layer.provide(makeTestConfigLayer({ SERVER_CORS_ORIGIN: "http://dashboard.test" })),
      ),
    ),
  );
  let response: HttpServerResponse.HttpServerResponse | undefined;
  yield* HttpEffect.toHandled(handler, (_request, result) =>
    Effect.sync(() => {
      response = result;
    }),
  ).pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
  );
  if (!response) return yield* Effect.die("Missing response");
  return response;
});

layer(TestServerLayer)("session mutation origins", (it) => {
  for (const action of ["others", "selected", "logout"] as const) {
    for (const origin of [
      undefined,
      "null",
      "https://untrusted.example.com",
      "http://dashboard.test",
    ] as const) {
      it.effect(`${action} with Origin ${origin}`, () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const client = yield* makeTestApiClient;
          const current = yield* signIn(
            client,
            testEmail(`session-${action}-${String(origin).replace(/[^a-z]/g, "")}@example.com`),
          );
          const other = yield* createSession(current.actor);
          const repository = yield* Repository;
          const before = yield* repository.audit.user.findForUser(current.actor.user.id);
          const path =
            action === "others" ? "revoke" : action === "logout" ? "logout" : other.session.id;
          const response = yield* send(
            new Request(`http://api.test/auth/session/sessions/${path}`, {
              method: action === "others" ? "POST" : "DELETE",
              headers: {
                ...(origin === undefined ? {} : { origin }),
                cookie: `auth-token=${current.cookie.value}`,
                "content-type": "application/x-www-form-urlencoded",
                "sec-fetch-site": "same-site",
              },
              ...(action === "others" ? { body: "" } : {}),
            }),
          );
          if (origin === "http://dashboard.test") {
            expect(response.headers["access-control-allow-origin"]).toBe(origin);
            expect(response.status).toBeLessThan(300);
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(
              (yield* repository.audit.user.findForUser(current.actor.user.id)).length,
            ).toBeGreaterThan(before.length);
          } else {
            expect(response.status).toBe(403);
            expect(response.cookies.cookies["auth-token"]).toBeUndefined();
            expect(yield* client.session.listSessions()).toHaveLength(2);
            expect(yield* repository.audit.user.findForUser(current.actor.user.id)).toEqual(before);
          }
        }),
      );
    }
  }
});
