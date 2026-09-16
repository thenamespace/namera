import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { Passkeys } from "@namera-ai/passkeys";
import { VerificationId } from "@namera-ai/protocol";
import { MagicLinkToken } from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer, TestEmails } from "../../fixtures/layers/index.js";

const adminToken = "test-only-invite-admin-token-32-characters";
const BetaLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  makeTestConfigLayer({ AUTH_INVITE_REQUIRED: "true", ADMIN_TOKEN: adminToken }),
);
const adminClient = handledApi(NameraApi, { headers: { authorization: `Bearer ${adminToken}` } });
const createInvite = Effect.gen(function* () {
  const admin = yield* adminClient;
  const result = yield* admin.betaInvite.create({ payload: { count: 1, expiresInDays: 7 } });
  const invite = result.invites[0];
  if (!invite) return yield* Effect.die("No invite returned");
  return invite;
});
const challenge = Effect.fn("test.betaInvite.challenge")(function* (
  code: string | undefined,
  emailValue: string,
  returnTo?: "/oauth/authorize?request=beta-test",
) {
  const client = yield* handledApi(NameraApi);
  const email = testEmail(emailValue);
  yield* client.magicLink.request({
    payload: { email, inviteCode: code, ...(returnTo === undefined ? {} : { returnTo }) },
  });
  const jobs = yield* EmailJobs;
  yield* jobs.processOnce;
  const emails = yield* TestEmails;
  const mail = (yield* emails.sent).findLast(
    (entry) => entry.type === "magic-link" && entry.to === email,
  );
  if (!mail || mail.type !== "magic-link") return yield* Effect.die("Missing sign-in email");
  const url = new URL(mail.variables.magicLinkUrl);
  return {
    client,
    email,
    code: mail.variables.code,
    payload: {
      type: "token" as const,
      id: Schema.decodeSync(VerificationId)(url.searchParams.get("id") ?? ""),
      token: Schema.decodeSync(MagicLinkToken)(url.searchParams.get("token") ?? ""),
    },
  };
});

layer(BetaLayer)("private-beta invites", (it) => {
  it.effect("does not accept the admin token as a tenant actor", () =>
    Effect.gen(function* () {
      const admin = yield* adminClient;
      expect((yield* admin.session.currentActor({ responseMode: "response-only" })).status).toBe(
        401,
      );
    }),
  );
  it.effect("serializes two pending signups claiming one invite", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const invite = yield* createInvite;
      const clients = [];
      for (const email of ["pending-first@example.com", "pending-second@example.com"]) {
        const registration = yield* challenge(undefined, email);
        const response = yield* registration.client.magicLink.verify({
          payload: registration.payload,
          responseMode: "response-only",
        });
        clients.push(
          yield* handledApi(NameraApi, {
            headers: { cookie: `beta-signup=${response.cookies.cookies["beta-signup"]?.value}` },
          }),
        );
      }
      const responses = yield* Effect.all(
        clients.map((client) =>
          client.magicLink.redeemInvite({
            payload: { inviteCode: invite.code },
            responseMode: "response-only",
          }),
        ),
        { concurrency: "unbounded" },
      );
      expect(responses.map((response) => response.status).toSorted()).toEqual([200, 403]);
      expect(responses.filter((response) => response.cookies.cookies["auth-token"])).toHaveLength(
        1,
      );
    }),
  );
  it.effect("bounds invite guesses and rejects signup cookies as email-link credentials", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const registration = yield* challenge(undefined, "guesses@example.com");
      const response = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "response-only",
      });
      const credential = response.cookies.cookies["beta-signup"]?.value ?? "";
      const [id, token] = credential.split(".");
      expect(
        (yield* registration.client.magicLink.verify({
          payload: {
            type: "token",
            id: Schema.decodeUnknownSync(VerificationId)(id),
            token: Schema.decodeUnknownSync(MagicLinkToken)(token),
          },
          responseMode: "response-only",
        })).status,
      ).toBe(400);
      const client = yield* handledApi(NameraApi, {
        headers: { cookie: `beta-signup=${credential}` },
      });
      for (let attempt = 0; attempt < 5; attempt++) {
        expect(
          (yield* client.magicLink.redeemInvite({
            payload: { inviteCode: "AAAAAA" },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
      }
      const invite = yield* createInvite;
      expect(
        (yield* client.magicLink.redeemInvite({
          payload: { inviteCode: invite.code },
          responseMode: "response-only",
        })).status,
      ).toBe(400);
      expect(yield* (yield* Repository).auth.user.findByEmail(registration.email)).toBeUndefined();
    }),
  );
  it.effect("requires an invite after email verification without granting a normal session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const registration = yield* challenge(
        undefined,
        "pending@example.com",
        "/oauth/authorize?request=beta-test",
      );
      const result = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "decoded-and-response",
      });
      const [body, response] = result;
      expect(body.body.returnTo).toBe("/auth/invite");
      expect(response.cookies.cookies["auth-token"]).toBeUndefined();
      const pending = response.cookies.cookies["beta-signup"];
      expect(pending?.options?.httpOnly).toBe(true);
      expect(pending?.options?.path).toBe("/auth/magic-link");
      const repository = yield* Repository;
      expect(yield* repository.auth.user.findByEmail(registration.email)).toBeUndefined();
      const client = yield* handledApi(NameraApi, {
        headers: { cookie: `beta-signup=${pending?.value}` },
      });
      expect((yield* client.session.currentUser({ responseMode: "response-only" })).status).toBe(
        401,
      );
      const invite = yield* createInvite;
      const [destination, admitted] = yield* client.magicLink.redeemInvite({
        payload: { inviteCode: invite.code },
        responseMode: "decoded-and-response",
      });
      expect(destination.body.returnTo).toBe("/oauth/authorize?request=beta-test");
      expect(admitted.status).toBe(200);
      expect(admitted.cookies.cookies["auth-token"]).toBeDefined();
      expect(admitted.cookies.cookies["beta-signup"]?.value).toBe("");
      expect(yield* repository.auth.user.findByEmail(registration.email)).toBeDefined();
      expect(
        (yield* client.magicLink.redeemInvite({
          payload: { inviteCode: invite.code },
          responseMode: "response-only",
        })).status,
      ).toBe(400);
    }),
  );
  it.effect("rejects missing signup cookies and expires pending email proof", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const invite = yield* createInvite;
      const registration = yield* challenge(undefined, "expires-pending@example.com");
      expect(
        (yield* registration.client.magicLink.redeemInvite({
          payload: { inviteCode: invite.code },
          responseMode: "response-only",
        })).status,
      ).toBe(400);
      const response = yield* registration.client.magicLink.verify({
        payload: { type: "code", email: registration.email, code: registration.code },
        responseMode: "response-only",
      });
      const client = yield* handledApi(NameraApi, {
        headers: { cookie: `beta-signup=${response.cookies.cookies["beta-signup"]?.value}` },
      });
      yield* TestClock.adjust("11 minutes");
      expect(
        (yield* client.magicLink.redeemInvite({
          payload: { inviteCode: invite.code },
          responseMode: "response-only",
        })).status,
      ).toBe(400);
      expect(yield* (yield* Repository).auth.user.findByEmail(registration.email)).toBeUndefined();
    }),
  );
  it.effect("redeems an invite through the email code and prevents link reuse", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const invite = yield* createInvite;
      const registration = yield* challenge(invite.code, "otp-beta@example.com");
      const response = yield* registration.client.magicLink.verify({
        payload: { type: "code", email: registration.email, code: registration.code },
        responseMode: "response-only",
      });
      expect(response.status).toBe(200);
      expect(response.cookies.cookies["auth-token"]).toBeDefined();
      const ownerClient = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${response.cookies.cookies["auth-token"]?.value}` },
      });
      expect(
        (yield* ownerClient.session.currentActor({ responseMode: "response-only" })).status,
      ).toBe(200);
      expect(
        (yield* ownerClient.betaInvite.create({
          payload: { count: 1 },
          responseMode: "response-only",
        })).status,
      ).toBe(401);
      const replay = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "response-only",
      });
      expect(replay.status).toBe(400);
    }),
  );
  it.effect("protects management from missing and wrong credentials", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const anonymous = yield* handledApi(NameraApi);
      const wrong = yield* handledApi(NameraApi, {
        headers: { authorization: "Bearer not-the-admin-token" },
      });
      for (const client of [anonymous, wrong]) {
        const response = yield* client.betaInvite.create({
          payload: { count: 1, expiresInDays: 7 },
          responseMode: "response-only",
        });
        expect(response.status).toBe(401);
      }
    }),
  );
  it.effect("generates bounded single-use codes, stores HMACs, and admits a verified user", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const invite = yield* createInvite;
      expect(invite.code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
      expect(new URL(invite.url).searchParams.get("invite")).toBe(invite.code);
      const repository = yield* Repository;
      const registration = yield* challenge(invite.code, "beta@example.com");
      expect(yield* repository.auth.user.findByEmail(registration.email)).toBeUndefined();
      const locked = yield* repository.auth.betaInvite.lockActive(invite.id, yield* DateTime.now);
      expect(locked?.codeHmac).not.toBe(invite.code);
      const response = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "response-only",
      });
      expect(response.status).toBe(200);
      expect(response.cookies.cookies["auth-token"]).toBeDefined();
      expect(
        yield* repository.auth.betaInvite.lockActive(invite.id, yield* DateTime.now),
      ).toBeUndefined();
      const replay = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "response-only",
      });
      expect(replay.status).toBe(400);
      yield* TestClock.adjust("2 minutes");
      yield* registration.client.magicLink.request({ payload: { email: registration.email } });
      expect(
        yield* repository.auth.verification.findPendingByIdentifier({
          purpose: "magic-link-signin",
          identifier: registration.email,
          now: yield* DateTime.now,
          maxAttempts: 5,
        }),
      ).toBeDefined();
    }),
  );
  it.effect("sends verification email before asking for an invite", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* handledApi(NameraApi);
      const response = yield* client.magicLink.request({
        payload: { email: testEmail("uninvited@example.com") },
        responseMode: "response-only",
      });
      expect(response.status).toBe(202);
      expect(yield* (yield* EmailJobs).processOnce).toBe(1);
    }),
  );
  it.effect("rejects revoked and expired invites, including after sending the email", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const invite = yield* createInvite;
      const registration = yield* challenge(invite.code, "revoked@example.com");
      const admin = yield* adminClient;
      yield* admin.betaInvite.revoke({ params: { id: invite.id } });
      const response = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "response-only",
      });
      expect(response.status).toBe(200);
      expect(response.cookies.cookies["auth-token"]).toBeUndefined();
      expect(response.cookies.cookies["beta-signup"]).toBeDefined();
      expect(yield* (yield* Repository).auth.user.findByEmail(registration.email)).toBeUndefined();
      const expired = yield* createInvite;
      yield* TestClock.adjust("8 days");
      const invalid = yield* registration.client.magicLink.request({
        payload: { email: registration.email, inviteCode: expired.code },
        responseMode: "response-only",
      });
      expect(invalid.status).toBe(202);
    }),
  );
  it.effect("allows only one verified signup when two emails redeem the same invite", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const invite = yield* createInvite;
      const first = yield* challenge(invite.code, "first@example.com");
      const second = yield* challenge(invite.code, "second@example.com");
      const responses = yield* Effect.all(
        [first, second].map(({ client, payload }) =>
          client.magicLink.verify({ payload, responseMode: "response-only" }),
        ),
        { concurrency: "unbounded" },
      );
      expect(responses.map((response) => response.status)).toEqual([200, 200]);
      expect(responses.filter((response) => response.cookies.cookies["auth-token"])).toHaveLength(
        1,
      );
      expect(
        responses.filter((response) => response.cookies.cookies["beta-signup"]?.value),
      ).toHaveLength(1);
      const repository = yield* Repository;
      const users = yield* Effect.all(
        [first, second].map(({ email }) => repository.auth.user.findByEmail(email)),
      );
      expect(users.filter(Boolean)).toHaveLength(1);
      const database = yield* Database;
      const events = yield* database.query.betaInviteEvent.findMany({
        where: { inviteId: { eq: invite.id } },
      });
      expect(events.map((event) => event.event).toSorted()).toEqual(["created", "redeemed"]);
    }),
  );
  it.effect("enforces recipient binding", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const admin = yield* adminClient;
      const result = yield* admin.betaInvite.create({
        payload: { count: 1, expiresInDays: 7, email: testEmail("bound@example.com") },
      });
      const invite = result.invites[0];
      if (!invite) return yield* Effect.die("Missing invite");
      const registration = yield* challenge(invite.code, "wrong@example.com");
      const response = yield* registration.client.magicLink.verify({
        payload: registration.payload,
        responseMode: "response-only",
      });
      expect(response.status).toBe(200);
      expect(response.cookies.cookies["auth-token"]).toBeUndefined();
      const pendingClient = yield* handledApi(NameraApi, {
        headers: { cookie: `beta-signup=${response.cookies.cookies["beta-signup"]?.value}` },
      });
      const rejected = yield* pendingClient.magicLink.redeemInvite({
        payload: { inviteCode: invite.code },
        responseMode: "response-only",
      });
      expect(rejected.status).toBe(403);
    }),
  );
});
