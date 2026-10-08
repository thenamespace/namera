import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { VerificationId } from "@namera-ai/protocol";
import { MagicLinkCode, MagicLinkReturnTo, MagicLinkToken } from "@namera-ai/protocol/dto";

import { handledApi } from "../../../fixtures/http-api-test.js";
import {
  makeTestApiClient,
  requestMagicLink,
  resetTestState,
  signIn,
  testEmail,
} from "../../../fixtures/index.js";
import { TestEmails, TestServerLayer } from "../../../fixtures/layers/index.js";

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
      // The second request may observe cooldown or replace the first challenge.
      // Either schedule must leave exactly one redeemable credential.
      expect(responses.length).toBeGreaterThanOrEqual(1);
      expect(responses.length).toBeLessThanOrEqual(2);
      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(
        responses.every((response) => response.status === 200 || response.status === 400),
      ).toBe(true);
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

  it.effect("allows only one concurrent redemption across the token and code", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("concurrent-redemption@example.com");
      const link = yield* requestMagicLink(client, email);
      const responses = yield* Effect.all(
        Array.from({ length: 8 }, (_, index) =>
          client.magicLink.verify(
            index % 2 === 0
              ? {
                  payload: { type: "token", id: link.id, token: link.token },
                  responseMode: "response-only",
                }
              : {
                  payload: {
                    type: "code",
                    email,
                    code: Schema.decodeSync(MagicLinkCode)(link.code),
                  },
                  responseMode: "response-only",
                },
          ),
        ),
        { concurrency: 8 },
      );
      expect(responses.filter((response) => response.status === 200)).toHaveLength(1);
      expect(responses.filter((response) => response.status === 400)).toHaveLength(7);
      expect(responses.filter((response) => response.cookies.cookies["auth-token"])).toHaveLength(
        1,
      );
      const repository = yield* Repository;
      const consumed = yield* repository.auth.verification.findById(link.id);
      expect(consumed).toBeDefined();
      expect(consumed?.consumedAt).not.toBeNull();
      const user = yield* repository.auth.user.findByEmail(email);
      if (user === undefined) return yield* Effect.die("Expected signed-in user");
      expect(
        yield* repository.auth.session.findActiveForUser(user.id, yield* DateTime.now),
      ).toHaveLength(1);
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
        actionUrl: "http://dashboard.test/auth?returnTo=%2Fsettings%2Fsecurity",
        ipAddress: "203.0.113.10",
        userAgent: "Namera test client",
      });
    }),
  );

  for (const type of ["token", "code"] as const) {
    it.effect(`serializes ${type} redemption against the final failed code attempt`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const email = testEmail(`final-attempt-${type}@example.com`);
        const link = yield* requestMagicLink(client, email);
        const wrongCode = Schema.decodeSync(MagicLinkCode)(
          link.code === "00000000" ? "11111111" : "00000000",
        );
        for (let attempt = 0; attempt < 4; attempt += 1) {
          expect(
            (yield* client.magicLink.verify({
              payload: { type: "code", email, code: wrongCode },
              responseMode: "response-only",
            })).status,
          ).toBe(400);
        }
        const responses = yield* Effect.all(
          [
            client.magicLink.verify(
              type === "token"
                ? {
                    payload: { type, id: link.id, token: link.token },
                    responseMode: "response-only",
                  }
                : {
                    payload: { type, email, code: Schema.decodeSync(MagicLinkCode)(link.code) },
                    responseMode: "response-only",
                  },
            ),
            ...Array.from({ length: 7 }, () =>
              client.magicLink.verify({
                payload: { type: "code", email, code: wrongCode },
                responseMode: "response-only",
              }),
            ),
          ],
          { concurrency: "unbounded" },
        );
        const repository = yield* Repository;
        const verification = yield* repository.auth.verification.findById(link.id);
        if (verification === undefined) return yield* Effect.die("Expected verification");
        const user = yield* repository.auth.user.findByEmail(email);
        if (responses[0]?.status === 200) {
          expect(verification.attempts).toBe(4);
          expect(verification.consumedAt).not.toBeNull();
          if (user === undefined) return yield* Effect.die("Expected signed-in user");
          expect(
            yield* repository.auth.session.findActiveForUser(user.id, yield* DateTime.now),
          ).toHaveLength(1);
          expect(
            responses.filter((response) => response.cookies.cookies["auth-token"]),
          ).toHaveLength(1);
        } else {
          expect(responses[0]?.status).toBe(400);
          expect(verification.attempts).toBe(5);
          expect(verification.consumedAt).toBeNull();
          expect(user).toBeUndefined();
          expect(responses.filter((response) => response.status === 429)).toHaveLength(1);
          expect(responses.every((response) => !response.cookies.cookies["auth-token"])).toBe(true);
        }
        expect(
          responses
            .slice(1)
            .every((response) => response.status === 400 || response.status === 429),
        ).toBe(true);
      }),
    );
  }

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
