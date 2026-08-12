import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { MagicLinkCode, MagicLinkToken } from "@namera-ai/protocol/dto";

import {
  makeTestApiClient,
  requestMagicLink,
  resetTestState,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestEmails, TestServerLayer } from "../layers/index.js";

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

  it.effect("verifies a token, creates the initial account, and sets the auth cookie", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("token@example.com");
      const signedIn = yield* signIn(client, email);

      expect(signedIn.verification).toEqual({ returnTo: "/dashboard" });
      expect(signedIn.cookie.options).toMatchObject({
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: true,
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

      expect(result.body.returnTo).toBe("/dashboard");
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.cookies.cookies["auth-token"]?.value).toBeTruthy();
    }),
  );

  it.effect("rejects invalid and already-consumed tokens", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("single-use@example.com");
      const magicLink = yield* requestMagicLink(client, email);
      const invalidToken = Schema.decodeSync(MagicLinkToken)("A".repeat(43));

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
});
