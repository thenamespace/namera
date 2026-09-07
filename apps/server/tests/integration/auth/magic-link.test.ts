import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { VerificationId } from "@namera-ai/protocol";
import { MagicLinkCode, MagicLinkReturnTo, MagicLinkToken } from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  makeTestApiClient,
  requestMagicLink,
  resetTestState,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestEmails, TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("magic-link routes", (it) => {
  it.effect("accepts a request and captures the typed email", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("request@example.com");
      const result = yield* requestMagicLink(client, email);

      expect(result.response.status).toBe(202);
      expect(result.response.headers["cache-control"]).toBe("no-store");
      expect(result.body.message).toContain("we sent a sign-in email");
      expect(result.code).toMatch(/^\d{8}$/);
      expect(new URL(`http://test/?token=${result.token}`).searchParams.get("token")).toBe(
        result.token,
      );
    }),
  );

  it.effect("does not send another email during the resend cooldown", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("cooldown@example.com");
      yield* requestMagicLink(client, email);
      yield* client.magicLink.request({ payload: { email } });

      const emails = yield* TestEmails;
      expect((yield* emails.sent).length).toBe(1);
    }),
  );

  it.effect("keeps only one active credential for concurrent requests", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("concurrent@example.com");

      yield* Effect.all(
        [
          client.magicLink.request({ payload: { email } }),
          client.magicLink.request({ payload: { email } }),
        ],
        { concurrency: "unbounded" },
      );
      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      while ((yield* emailJobs.processOnce) > 0) {
        // Drain the deterministic test outbox.
      }
      const messages = (yield* emails.sent).filter((message) => message.type === "magic-link");
      const responses = yield* Effect.forEach(messages, (message) => {
        const url = new URL(message.variables.magicLinkUrl);
        return client.magicLink.verify({
          payload: {
            type: "token",
            id: Schema.decodeSync(VerificationId)(url.searchParams.get("id") ?? ""),
            token: Schema.decodeSync(MagicLinkToken)(url.searchParams.get("token") ?? ""),
          },
          responseMode: "response-only",
        });
      });
      expect(responses.map((response) => response.status).toSorted()).toEqual([200, 400]);
    }),
  );

  it.effect("verifies a token, creates the initial account, and sets the auth cookie", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("token@example.com");
      const signedIn = yield* signIn(client, email);

      expect(signedIn.verification).toEqual({ returnTo: "/" });
      expect(signedIn.cookie.options).toMatchObject({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false,
      });
      expect(signedIn.actor.user.email).toBe(email);
      expect(signedIn.actor.user.emailVerified).toBe(true);
      expect(signedIn.actor.organization.metadata.name).toBe("Personal");
      expect(signedIn.actor.role.key).toBe("owner");
    }),
  );

  it.effect("verifies the email code", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("code@example.com");
      const magicLink = yield* requestMagicLink(client, email);

      const [result, response] = yield* client.magicLink.verify({
        payload: {
          type: "code",
          email,
          code: Schema.decodeSync(MagicLinkCode)(magicLink.code),
        },
        responseMode: "decoded-and-response",
      });

      expect(result.body.returnTo).toBe("/");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.cookies.cookies["auth-token"]?.value).toBeTruthy();
    }),
  );

  it.effect("persists request context on the session and security notification", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi, {
        headers: { "user-agent": "Namera test client" },
        remoteAddress: "203.0.113.10",
      });
      const signedIn = yield* signIn(client, testEmail("context@example.com"));

      expect(signedIn.actor.session.ipAddress).toBe("203.0.113.10");
      expect(signedIn.actor.session.userAgent).toBe("Namera test client");

      const repository = yield* Repository;
      const notifications = yield* repository.notification.inbox.listForUser({
        userId: signedIn.actor.user.id,
        limit: 10,
        now: yield* DateTime.now,
      });
      const notification = notifications.find(
        (item) => item.notification.type === "auth.new-sign-in",
      )?.notification;
      expect(notification?.data).toMatchObject({
        ipAddress: "203.0.113.10",
        userAgent: "Namera test client",
      });
      const emailJobs = yield* EmailJobs;
      yield* emailJobs.processOnce;
      const emails = yield* TestEmails;
      const email = (yield* emails.sent).findLast((message) => message.type === "new-sign-in");
      expect(email?.variables).toMatchObject({
        ipAddress: "203.0.113.10",
        userAgent: "Namera test client",
      });
    }),
  );

  it.effect("keeps only configured application return paths", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const allowed = Schema.decodeSync(MagicLinkReturnTo)("/settings/profile");
      const invitation = Schema.decodeSync(MagicLinkReturnTo)(
        "/invitations/00000000-0000-4000-8000-000000000001",
      );
      const oauth = Schema.decodeSync(MagicLinkReturnTo)(
        "/oauth/authorize?requestId=00000000-0000-4000-8000-000000000001",
      );
      const denied = Schema.decodeSync(MagicLinkReturnTo)("/admin");
      const traversal = Schema.decodeSync(MagicLinkReturnTo)("/settings/../admin");

      const allowedLink = yield* requestMagicLink(
        client,
        testEmail("allowed-return@example.com"),
        allowed,
      );
      const allowedResult = yield* client.magicLink.verify({
        payload: { type: "token", id: allowedLink.id, token: allowedLink.token },
      });
      expect(allowedResult.body.returnTo).toBe(allowed);

      const invitationLink = yield* requestMagicLink(
        client,
        testEmail("invitation-return@example.com"),
        invitation,
      );
      const invitationResult = yield* client.magicLink.verify({
        payload: {
          type: "token",
          id: invitationLink.id,
          token: invitationLink.token,
        },
      });
      expect(invitationResult.body.returnTo).toBe(invitation);

      const oauthLink = yield* requestMagicLink(
        client,
        testEmail("oauth-return@example.com"),
        oauth,
      );
      const oauthResult = yield* client.magicLink.verify({
        payload: { type: "token", id: oauthLink.id, token: oauthLink.token },
      });
      expect(oauthResult.body.returnTo).toBe(oauth);

      const deniedLink = yield* requestMagicLink(
        client,
        testEmail("denied-return@example.com"),
        denied,
      );
      const deniedResult = yield* client.magicLink.verify({
        payload: { type: "token", id: deniedLink.id, token: deniedLink.token },
      });
      expect(deniedResult.body.returnTo).toBe("/");

      const traversalLink = yield* requestMagicLink(
        client,
        testEmail("traversal-return@example.com"),
        traversal,
      );
      const traversalResult = yield* client.magicLink.verify({
        payload: {
          type: "token",
          id: traversalLink.id,
          token: traversalLink.token,
        },
      });
      expect(traversalResult.body.returnTo).toBe("/");
    }),
  );

  it.effect("rejects invalid and already-consumed tokens", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("single-use@example.com");
      const magicLink = yield* requestMagicLink(client, email);
      const invalidToken = Schema.decodeSync(MagicLinkToken)("A".repeat(43));

      const invalidResponse = yield* client.magicLink.verify({
        payload: { type: "token", id: magicLink.id, token: invalidToken },
        responseMode: "response-only",
      });
      expect(invalidResponse.status).toBe(400);

      const invalid = yield* client.magicLink
        .verify({
          payload: { type: "token", id: magicLink.id, token: invalidToken },
        })
        .pipe(Effect.flip);
      expect(invalid).toMatchObject({
        _tag: "MagicLinkError",
        code: "INVALID_OR_EXPIRED_LINK",
      });

      yield* client.magicLink.verify({
        payload: { type: "token", id: magicLink.id, token: magicLink.token },
      });
      const consumed = yield* client.magicLink
        .verify({
          payload: { type: "token", id: magicLink.id, token: magicLink.token },
        })
        .pipe(Effect.flip);
      expect(consumed).toMatchObject({
        _tag: "MagicLinkError",
        code: "INVALID_OR_EXPIRED_LINK",
      });
    }),
  );

  it.effect("locks code verification after the maximum failed attempts", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("attempts@example.com");
      yield* requestMagicLink(client, email);
      const wrongCode = Schema.decodeSync(MagicLinkCode)("00000000");

      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const error = yield* client.magicLink
          .verify({ payload: { type: "code", email, code: wrongCode } })
          .pipe(Effect.flip);
        expect(error).toMatchObject({
          _tag: "MagicLinkError",
          code: attempt === 5 ? "TOO_MANY_ATTEMPTS" : "INVALID_OR_EXPIRED_LINK",
        });
      }
    }),
  );

  it.effect("returns a rate-limit status when code attempts are exhausted", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("attempt-status@example.com");
      yield* requestMagicLink(client, email);
      const wrongCode = Schema.decodeSync(MagicLinkCode)("00000000");

      for (let attempt = 1; attempt < 5; attempt += 1) {
        yield* client.magicLink.verify({
          payload: { type: "code", email, code: wrongCode },
          responseMode: "response-only",
        });
      }
      const response = yield* client.magicLink.verify({
        payload: { type: "code", email, code: wrongCode },
        responseMode: "response-only",
      });
      expect(response.status).toBe(429);
    }),
  );
});
