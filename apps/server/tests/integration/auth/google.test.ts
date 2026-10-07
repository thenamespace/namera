import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect, Result, Schema } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application, googleIdentityTestLayer } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { Passkeys } from "@namera-ai/passkeys";
import { VerificationId } from "@namera-ai/protocol";
import { MagicLinkToken } from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, signIn, testEmail, setAuthToken } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer, TestEmails } from "../../fixtures/layers/index.js";

const provider = googleIdentityTestLayer({
  alice: {
    subject: "google-alice",
    email: testEmail("alice@gmail.com"),
    emailAuthoritative: true,
    name: "Alice",
  },
  bob: { subject: "google-bob", email: testEmail("bob@gmail.com"), emailAuthoritative: true },
  external: {
    subject: "google-external",
    email: testEmail("external@example.com"),
    emailAuthoritative: false,
  },
});
const GoogleLayer = makeTestServerLayer({}, Passkeys.testLayer, makeTestConfigLayer(), provider);
const clientWithOrigin = handledApi(NameraApi, { headers: { origin: "http://dashboard.test" } });
const start = Effect.gen(function* () {
  const client = yield* clientWithOrigin;
  const [body, response] = yield* client.google.start({
    payload: {},
    responseMode: "decoded-and-response",
  });
  const url = new URL(body.authorizationUrl);
  return {
    state: url.searchParams.get("state") ?? "",
    nonce: url.searchParams.get("nonce") ?? "",
    browserToken: response.cookies.cookies["google-auth"]?.value ?? "",
  };
});
const callback = Effect.fnUntraced(function* (
  flow: { state: string; nonce: string; browserToken: string },
  identity = "alice",
  authToken?: string,
) {
  const app = yield* Application;
  return yield* app.google.complete(
    {
      state: flow.state,
      browserToken: flow.browserToken,
      code: `${identity}:${flow.nonce}`,
      ...(authToken ? { authToken } : {}),
    },
    { ipAddress: null, userAgent: null },
  );
});

layer(GoogleLayer)("Google authentication", (it) => {
  it.effect("allows only one of two concurrent callbacks for one proof", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const flow = yield* start;
      const results = yield* Effect.all(
        [callback(flow).pipe(Effect.result), callback(flow).pipe(Effect.result)],
        { concurrency: "unbounded" },
      );
      expect(results.filter(Result.isSuccess)).toHaveLength(1);
      expect(results.filter(Result.isFailure)).toHaveLength(1);
      const binding = yield* (yield* Repository).auth.account.findGoogle("google-alice");
      expect(binding).toBeDefined();
    }),
  );
  it.effect("never connects two Google identities to the same user", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* clientWithOrigin;
      const existing = yield* signIn(client, testEmail("owner@example.com"));
      const app = yield* Application;
      const flows = yield* Effect.forEach(["alice", "bob"], (name) =>
        Effect.gen(function* () {
          const flow = yield* app.google.start(
            {},
            { userId: existing.actor.user.id, sessionId: existing.actor.session.id },
          );
          const url = new URL(flow.authorizationUrl);
          return {
            name,
            flow: {
              state: url.searchParams.get("state") ?? "",
              nonce: url.searchParams.get("nonce") ?? "",
              browserToken: flow.browserToken,
            },
          };
        }),
      );
      const results = yield* Effect.all(
        flows.map(({ name, flow }) =>
          callback(flow, name, existing.cookie.value).pipe(Effect.result),
        ),
        { concurrency: "unbounded" },
      );
      expect(results.filter(Result.isSuccess)).toHaveLength(1);
      expect(results.filter(Result.isFailure)).toHaveLength(1);
      expect(yield* client.connectedAccounts.list({})).toHaveLength(1);
    }),
  );
  it.effect("sets browser-bound cookies and rejects cross-origin starts", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi, { headers: { origin: "https://attacker.test" } });
      expect(
        (yield* client.google.start({ payload: {}, responseMode: "response-only" })).status,
      ).toBe(400);
      const trusted = yield* clientWithOrigin;
      const response = yield* trusted.google.start({ payload: {}, responseMode: "response-only" });
      expect(response.cookies.cookies["google-auth"]?.options).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/auth/google/callback",
      });
    }),
  );
  it.effect("creates a user, binding, audit and notification, then reuses the Google subject", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const first = yield* callback(yield* start);
      expect("sessionToken" in first).toBe(true);
      const repository = yield* Repository;
      const binding = yield* repository.auth.account.findGoogle("google-alice");
      if (!binding) return yield* Effect.die("Missing Google account binding");
      expect(binding?.accessToken).toBeNull();
      expect(binding?.idToken).toBeNull();
      expect(binding?.providerEmail).toBe("alice@gmail.com");
      const events = yield* repository.audit.user.findForUser(binding.userId);
      expect(events.filter((event) => event.event === "user.account_linked")).toHaveLength(1);
      expect(events.filter((event) => event.event === "user.signed_in")).toHaveLength(1);
      yield* callback(yield* start);
      expect(yield* repository.auth.account.list(binding.userId)).toHaveLength(1);
      expect(
        (yield* repository.audit.user.findForUser(binding.userId)).filter(
          (event) => event.event === "user.account_linked",
        ),
      ).toHaveLength(1);
      const jobs = yield* EmailJobs;
      while ((yield* jobs.processOnce) > 0) {}
      const emails = yield* TestEmails;
      expect((yield* emails.sent).some((mail) => mail.type === "connected-account-changed")).toBe(
        true,
      );
    }),
  );
  it.effect("rejects wrong browser, wrong nonce, expired state and replayed callbacks", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const flow = yield* start;
      expect((yield* callback({ ...flow, browserToken: "wrong" }).pipe(Effect.flip)).code).toBe(
        "GOOGLE_FLOW_INVALID",
      );
      expect((yield* callback({ ...flow, nonce: "wrong" }).pipe(Effect.flip)).code).toBe(
        "GOOGLE_FLOW_INVALID",
      );
      expect((yield* callback(flow).pipe(Effect.flip)).code).toBe("GOOGLE_FLOW_INVALID");
      const expired = yield* start;
      yield* TestClock.adjust(Duration.minutes(11));
      expect((yield* callback(expired).pipe(Effect.flip)).code).toBe("GOOGLE_FLOW_INVALID");
    }),
  );
  it.effect("does not automatically connect a matching existing email", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* clientWithOrigin;
      const existing = yield* signIn(client, testEmail("alice@gmail.com"));
      expect((yield* callback(yield* start).pipe(Effect.flip)).code).toBe("GOOGLE_ACCOUNT_EXISTS");
      expect(yield* (yield* Repository).auth.account.list(existing.actor.user.id)).toHaveLength(0);
    }),
  );
  it.effect("explicit linking binds the initiating session; unlink preserves email access", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* clientWithOrigin;
      const existing = yield* signIn(client, testEmail("owner@example.com"));
      const [body, response] = yield* client.connectedAccounts.connectGoogle({
        responseMode: "decoded-and-response",
      });
      const url = new URL(body.authorizationUrl);
      const flow = {
        state: url.searchParams.get("state") ?? "",
        nonce: url.searchParams.get("nonce") ?? "",
        browserToken: response.cookies.cookies["google-auth"]?.value ?? "",
      };
      expect((yield* callback(flow, "alice", "different-session").pipe(Effect.flip)).code).toBe(
        "GOOGLE_FLOW_INVALID",
      );
      const app = yield* Application;
      const fresh = yield* app.google.start(
        {},
        { userId: existing.actor.user.id, sessionId: existing.actor.session.id },
      );
      const freshUrl = new URL(fresh.authorizationUrl);
      yield* callback(
        {
          state: freshUrl.searchParams.get("state") ?? "",
          nonce: freshUrl.searchParams.get("nonce") ?? "",
          browserToken: fresh.browserToken,
        },
        "alice",
        existing.cookie.value,
      );
      const linked = yield* client.connectedAccounts.list({});
      expect(linked).toHaveLength(1);
      const account = linked[0];
      if (!account) return yield* Effect.die("Missing connected account");
      yield* client.connectedAccounts.unlink({ params: { accountId: account.id } });
      expect(yield* client.connectedAccounts.list({})).toHaveLength(0);
      expect((yield* client.session.currentUser()).user.id).toBe(existing.actor.user.id);
      yield* TestClock.setTime(
        DateTime.toEpochMillis(existing.actor.session.createdAt) +
          Duration.toMillis(Duration.minutes(11)),
      );
      expect(
        (yield* app.google
          .start({}, { userId: existing.actor.user.id, sessionId: existing.actor.session.id })
          .pipe(Effect.flip)).code,
      ).toBe("REAUTHENTICATION_REQUIRED");
    }),
  );
  it.effect("sends third-party emails through email proof before connecting Google", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      expect((yield* callback(yield* start, "external")).returnTo).toBe(
        "/auth?google=EMAIL_LOGIN_REQUIRED",
      );
      expect(yield* (yield* Repository).auth.account.findGoogle("google-external")).toBeUndefined();
      yield* (yield* EmailJobs).processOnce;
      const mail = (yield* (yield* TestEmails).sent).find((email) => email.type === "magic-link");
      if (!mail || mail.type !== "magic-link") return yield* Effect.die("Missing email proof");
      const url = new URL(mail.variables.magicLinkUrl);
      const client = yield* clientWithOrigin;
      yield* client.magicLink.verify({
        payload: {
          type: "token",
          id: Schema.decodeSync(VerificationId)(url.searchParams.get("id") ?? ""),
          token: Schema.decodeSync(MagicLinkToken)(url.searchParams.get("token") ?? ""),
        },
      });
      expect(yield* (yield* Repository).auth.account.findGoogle("google-external")).toBeDefined();
    }),
  );
  it.effect("redirects the actual callback without leaking OAuth credentials", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* setAuthToken();
      const flow = yield* start;
      const handler = yield* HttpRouter.toHttpEffect(HttpApiBuilder.layer(NameraApi));
      let response: HttpServerResponse.HttpServerResponse | undefined;
      const url = new URL("http://api.test/auth/google/callback");
      url.search = new URLSearchParams({
        state: flow.state,
        code: `alice:${flow.nonce}`,
      }).toString();
      yield* HttpEffect.toHandled(handler, (_request, result) =>
        Effect.sync(() => {
          response = result;
        }),
      ).pipe(
        Effect.provideService(
          HttpServerRequest.HttpServerRequest,
          HttpServerRequest.fromWeb(
            new Request(url, { headers: { cookie: `google-auth=${flow.browserToken}` } }),
          ),
        ),
      );
      expect(response?.status).toBe(302);
      expect(response?.headers.location).toBe("http://dashboard.test/");
      expect(response?.headers["cache-control"]).toBe("no-store");
      expect(response?.cookies.cookies["auth-token"]?.value).toBeTruthy();
      expect(response?.cookies.cookies["google-auth"]?.value).toBe("");
    }),
  );
});

const GoogleBetaLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  makeTestConfigLayer({
    AUTH_INVITE_REQUIRED: "true",
    ADMIN_TOKEN: "test-google-admin-token-32-characters",
  }),
  provider,
);
layer(GoogleBetaLayer)("Google beta admission", (it) => {
  it.effect(
    "creates no user before an invite and preserves Google identity through redemption",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const pending = yield* callback(yield* start);
        expect(pending.returnTo).toBe("/auth/invite");
        const repository = yield* Repository;
        expect(
          yield* repository.auth.user.findByEmail(testEmail("alice@gmail.com")),
        ).toBeUndefined();
        expect(yield* repository.auth.account.findGoogle("google-alice")).toBeUndefined();
        if (!("admissionToken" in pending)) return yield* Effect.die("Missing beta proof");
        const admin = yield* handledApi(NameraApi, {
          headers: { authorization: "Bearer test-google-admin-token-32-characters" },
        });
        const invite = (yield* admin.betaInvite.create({ payload: { count: 1 } })).invites[0];
        if (!invite) return yield* Effect.die("Missing invite");
        const client = yield* handledApi(NameraApi, {
          headers: { cookie: `beta-signup=${pending.admissionToken}` },
        });
        const response = yield* client.magicLink.redeemInvite({
          payload: { inviteCode: invite.code },
          responseMode: "response-only",
        });
        expect(response.status).toBe(200);
        expect(response.cookies.cookies["auth-token"]?.value).toBeTruthy();
        expect(yield* repository.auth.account.findGoogle("google-alice")).toBeDefined();
      }),
  );
  it.effect("does not auto-link if an email account appears after Google beta proof", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const pending = yield* callback(yield* start);
      if (!("admissionToken" in pending)) return yield* Effect.die("Missing beta proof");
      const repository = yield* Repository;
      yield* repository.auth.user.create({
        email: testEmail("alice@gmail.com"),
        metadata: { version: 1 },
      });
      const admin = yield* handledApi(NameraApi, {
        headers: { authorization: "Bearer test-google-admin-token-32-characters" },
      });
      const invite = (yield* admin.betaInvite.create({ payload: { count: 1 } })).invites[0];
      if (!invite) return yield* Effect.die("Missing invite");
      const client = yield* handledApi(NameraApi, {
        headers: { cookie: `beta-signup=${pending.admissionToken}` },
      });
      const response = yield* client.magicLink.redeemInvite({
        payload: { inviteCode: invite.code },
        responseMode: "response-only",
      });
      expect(response.status).toBe(400);
      expect(yield* repository.auth.account.findGoogle("google-alice")).toBeUndefined();
    }),
  );
});
