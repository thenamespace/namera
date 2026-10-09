import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { googleIdentityTestLayer } from "@namera-ai/application";
import { EmailJobs, TestEmails } from "@namera-ai/emails";
import { Passkeys } from "@namera-ai/passkeys";
import { VerificationId } from "@namera-ai/protocol";
import { MagicLinkToken } from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const testLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  makeTestConfigLayer({ ADMIN_CORS_ORIGIN: "http://admin.test" }),
  googleIdentityTestLayer({
    owner: {
      subject: "admin-google",
      email: testEmail("admin@gmail.com"),
      emailAuthoritative: true,
    },
  }),
);
const adminClient = handledApi(NameraApi, { headers: { origin: "http://admin.test" } });
const reset = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
});

layer(testLayer)("admin portal login", (it) => {
  it.effect("sends admin links to the portal and grants access only to a platform member", () =>
    Effect.gen(function* () {
      yield* reset;
      const owner = yield* platformIdentity("admin@gmail.com");
      const client = yield* adminClient;
      yield* client.magicLink.request({
        payload: { email: owner.user.email, surface: "admin", returnTo: "/" },
      });
      while ((yield* (yield* EmailJobs).processOnce) > 0) {}
      const mail = (yield* (yield* TestEmails).sent).findLast((m) => m.type === "magic-link");
      if (!mail || mail.type !== "magic-link") return yield* Effect.die("Missing sign-in email");
      const url = new URL(mail.variables.magicLinkUrl);
      expect(url.origin).toBe("http://admin.test");
      expect(url.pathname).toBe("/auth/verify");
      const response = yield* client.magicLink.verify({
        payload: {
          type: "token",
          id: Schema.decodeUnknownSync(VerificationId)(url.searchParams.get("id")),
          token: Schema.decodeUnknownSync(MagicLinkToken)(url.searchParams.get("token")),
        },
        responseMode: "response-only",
      });
      const authenticated = yield* handledApi(NameraApi, {
        headers: {
          origin: "http://admin.test",
          cookie: `auth-token=${response.cookies.cookies["auth-token"]?.value}`,
        },
      });
      expect((yield* authenticated.platform.me({})).member.id).toBe(owner.member.id);
    }),
  );

  it.effect("accepts email codes without granting ordinary users platform membership", () =>
    Effect.gen(function* () {
      yield* reset;
      const client = yield* adminClient;
      const email = testEmail("ordinary@example.com");
      yield* client.magicLink.request({ payload: { email, surface: "admin" } });
      while ((yield* (yield* EmailJobs).processOnce) > 0) {}
      const mail = (yield* (yield* TestEmails).sent).findLast((m) => m.type === "magic-link");
      if (!mail || mail.type !== "magic-link") return yield* Effect.die("Missing sign-in email");
      const response = yield* client.magicLink.verify({
        payload: { type: "code", email, code: mail.variables.code },
        responseMode: "response-only",
      });
      const ordinary = yield* handledApi(NameraApi, {
        headers: {
          origin: "http://admin.test",
          cookie: `auth-token=${response.cookies.cookies["auth-token"]?.value}`,
        },
      });
      expect((yield* ordinary.platform.me({ responseMode: "response-only" })).status).toBe(403);
    }),
  );

  it.effect("rejects admin auth starts from another origin", () =>
    Effect.gen(function* () {
      yield* reset;
      const client = yield* handledApi(NameraApi, { headers: { origin: "http://evil.test" } });
      expect(
        (yield* client.google.start({
          payload: { surface: "admin" },
          responseMode: "response-only",
        })).status,
      ).toBe(400);
      expect(
        (yield* client.magicLink.request({
          payload: { email: testEmail("admin@gmail.com"), surface: "admin" },
          responseMode: "response-only",
        })).status,
      ).toBe(403);
    }),
  );

  it.effect("returns Google success and cancellation to the configured admin origin", () =>
    Effect.gen(function* () {
      yield* reset;
      yield* platformIdentity("admin@gmail.com");
      const client = yield* adminClient;
      const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
      for (const canceled of [false, true]) {
        const [started, startResponse] = yield* client.google.start({
          payload: { surface: "admin", returnTo: "/settings/security" },
          responseMode: "decoded-and-response",
        });
        const authorization = new URL(started.authorizationUrl);
        const url = new URL("http://api.test/auth/google/callback");
        url.searchParams.set("state", authorization.searchParams.get("state") ?? "");
        if (canceled) url.searchParams.set("error", "access_denied");
        else url.searchParams.set("code", `owner:${authorization.searchParams.get("nonce")}`);
        let response: HttpServerResponse.HttpServerResponse | undefined;
        yield* HttpEffect.toHandled(handler, (_request, result) =>
          Effect.sync(() => {
            response = result;
          }),
        ).pipe(
          Effect.provideService(
            HttpServerRequest.HttpServerRequest,
            HttpServerRequest.fromWeb(
              new Request(url, {
                headers: {
                  cookie: `google-auth=${startResponse.cookies.cookies["google-auth"]?.value}`,
                },
              }),
            ),
          ),
        );
        expect(response?.status).toBe(302);
        expect(response?.headers.location).toBe(
          canceled ? "http://admin.test/auth?google=GOOGLE_CANCELED" : "http://admin.test/",
        );
        expect(response?.headers["cache-control"]).toBe("no-store");
        if (!canceled) expect(response?.cookies.cookies["auth-token"]?.value).toBeTruthy();
      }
    }),
  );
});
