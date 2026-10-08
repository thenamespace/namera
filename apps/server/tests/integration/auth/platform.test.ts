import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Result } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import {
  bootstrapPlatformOwner,
  Application,
  googleIdentityTestLayer,
} from "@namera-ai/application";
import { Database, Repository } from "@namera-ai/database";
import { EmailJobs, TestEmails } from "@namera-ai/emails";
import { Passkeys } from "@namera-ai/passkeys";

import { handledApi } from "../../fixtures/http-api-test.js";
import { resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const config = makeTestConfigLayer({
  AUTH_INVITE_REQUIRED: "true",
  ADMIN_CORS_ORIGIN: "http://admin.test",
});
const testLayer = makeTestServerLayer(
  {},
  Passkeys.testLayer,
  config,
  googleIdentityTestLayer({
    teammate: {
      subject: "google-teammate",
      email: testEmail("teammate@gmail.com"),
      emailAuthoritative: true,
    },
  }),
);

const resetPlatformTest = Effect.gen(function* () {
  yield* resetTestState();
  yield* TestClock.setTime(Date.now());
});

const deliveredToken = Effect.fnUntraced(function* (email: string) {
  const jobs = yield* EmailJobs;
  const emails = yield* TestEmails;
  for (let i = 0; i < 20; i++) {
    if (!(yield* jobs.processOnce)) break;
  }
  const sent = (yield* emails.sent).findLast(
    (mail) => mail.type === "platform-invitation" && mail.to === email,
  );
  if (!sent || sent.type !== "platform-invitation")
    return yield* Effect.die("Missing team invitation email");
  const url = new URL(sent.variables.invitationUrl);
  expect(url.origin).toBe("http://admin.test");
  expect(url.search).toBe("");
  return new URLSearchParams(url.hash.slice(1)).get("token") ?? "";
});

layer(testLayer)("platform membership lifecycle", (it) => {
  it.effect("returns the user's display metadata with team members", () =>
    Effect.gen(function* () {
      yield* resetPlatformTest;
      const owner = yield* platformIdentity();
      const members = yield* owner.client.platform.members();
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({ email: owner.user.email, metadata: owner.user.metadata });
    }),
  );
  it.effect("serializes first-owner bootstrap and refuses an unverified identity", () =>
    Effect.gen(function* () {
      yield* resetPlatformTest;
      const repository = yield* Repository;
      const emails = [testEmail("first-owner@example.com"), testEmail("second-owner@example.com")];
      for (const email of emails) {
        const user = yield* repository.auth.user.create({ email, metadata: { version: 1 } });
        const unverified = yield* bootstrapPlatformOwner(email).pipe(Effect.result);
        expect(Result.isFailure(unverified)).toBe(true);
        yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, yield* DateTime.now);
      }
      const results = yield* Effect.all(
        emails.map((email) => bootstrapPlatformOwner(email).pipe(Effect.result)),
        { concurrency: "unbounded" },
      );
      expect(results.filter(Result.isSuccess)).toHaveLength(1);
      expect(results.filter(Result.isFailure)).toHaveLength(1);
      expect(
        (yield* repository.auth.platform.listMembers()).filter((m) => m.role === "owner"),
      ).toHaveLength(1);
    }),
  );

  it.effect(
    "cancels queued mail on revoke and permits only one live invitation after concurrent resends",
    () =>
      Effect.gen(function* () {
        yield* resetPlatformTest;
        const owner = yield* platformIdentity();
        const email = testEmail("queued@example.com");
        const results = yield* Effect.all(
          [0, 1].map(() => owner.client.platform.invite({ payload: { email, role: "viewer" } })),
          { concurrency: "unbounded" },
        );
        const pending = (yield* owner.client.platform.invitations({ query: {} })).filter(
          (i) => i.revokedAt === null,
        );
        expect(pending).toHaveLength(1);
        const current = pending[0];
        if (!current) return yield* Effect.die("Missing live invitation");
        yield* owner.client.platform.revokeInvitation({ params: { id: current.id } });
        const repository = yield* Repository;
        for (const invitation of results) {
          const job = yield* repository.jobs.email.findByIdempotencyKey(
            `platform-invitation:${invitation.id}`,
          );
          expect(job?.status).toBe("canceled");
          expect(job?.encryptedPayload).toBeNull();
        }
        expect(yield* (yield* EmailJobs).processOnce).toBe(0);
      }),
  );
  it.effect(
    "invites a new email user, admits them without beta code, and consumes the team token once",
    () =>
      Effect.gen(function* () {
        yield* resetPlatformTest;
        const owner = yield* platformIdentity();
        const email = testEmail("teammate@example.com");
        yield* TestClock.adjust("11 minutes");
        const invitation = yield* owner.client.platform.invite({
          payload: { email, role: "operator" },
        });
        expect(invitation).not.toHaveProperty("tokenHash");
        const token = yield* deliveredToken(email);
        const db = yield* Database;
        expect((yield* db.query.platformInvitation.findFirst())?.tokenHash).not.toBe(token);
        const login = yield* signIn(yield* handledApi(NameraApi), email);
        const client = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${login.cookie.value}`, origin: "http://admin.test" },
        });
        yield* TestClock.adjust("11 minutes");
        expect((yield* client.platform.me({ responseMode: "response-only" })).status).toBe(403);
        const results = yield* Effect.all(
          Array.from({ length: 4 }, () =>
            client.platformInvitation.accept({ payload: { token }, responseMode: "response-only" }),
          ),
          { concurrency: "unbounded" },
        );
        expect(results.filter((r) => r.status === 200)).toHaveLength(1);
        expect(results.filter((r) => r.status === 403)).toHaveLength(3);
        expect((yield* client.platform.me()).member.role).toBe("operator");
        const events = yield* db.query.platformEvent.findMany();
        expect(events.filter((e) => e.data.type === "invitation.accepted")).toHaveLength(1);
        expect(events.find((e) => e.data.type === "invitation.created")?.actorMemberId).toBe(
          owner.member.id,
        );
      }),
  );

  it.effect("admits an invited authoritative Google identity without beta code", () =>
    Effect.gen(function* () {
      yield* resetPlatformTest;
      const owner = yield* platformIdentity();
      yield* owner.client.platform.invite({
        payload: { email: testEmail("teammate@gmail.com"), role: "viewer" },
      });
      const token = yield* deliveredToken("teammate@gmail.com");
      const app = yield* Application;
      const start = yield* app.google.start({});
      const url = new URL(start.authorizationUrl);
      const complete = yield* app.google.complete(
        {
          state: url.searchParams.get("state") ?? "",
          browserToken: start.browserToken,
          code: `teammate:${url.searchParams.get("nonce")}`,
        },
        { ipAddress: null, userAgent: null },
      );
      if (!("sessionToken" in complete)) return yield* Effect.die("Expected Google session");
      const client = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${complete.sessionToken}`, origin: "http://admin.test" },
      });
      expect((yield* client.platformInvitation.accept({ payload: { token } })).role).toBe("viewer");
    }),
  );

  it.effect(
    "revokes previous links on resend, binds email, and rejects expired or revoked tokens",
    () =>
      Effect.gen(function* () {
        yield* resetPlatformTest;
        const owner = yield* platformIdentity();
        const email = testEmail("resend@example.com");
        const first = yield* owner.client.platform.invite({ payload: { email, role: "viewer" } });
        const oldToken = yield* deliveredToken(email);
        const second = yield* owner.client.platform.invite({
          payload: { email, role: "operator" },
        });
        const token = yield* deliveredToken(email);
        expect(token).not.toBe(oldToken);
        expect(
          (yield* owner.client.platform.invitations({ query: {} })).find((i) => i.id === first.id)
            ?.revokedAt,
        ).not.toBeNull();
        expect(
          (yield* owner.client.platformInvitation.accept({
            payload: { token },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        const login = yield* signIn(yield* handledApi(NameraApi), email);
        const client = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${login.cookie.value}`, origin: "http://admin.test" },
        });
        expect(
          (yield* client.platformInvitation.accept({
            payload: { token: oldToken },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        yield* owner.client.platform.revokeInvitation({ params: { id: second.id } });
        expect(
          (yield* client.platformInvitation.accept({
            payload: { token },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        const third = yield* owner.client.platform.invite({ payload: { email, role: "viewer" } });
        const expiredToken = yield* deliveredToken(email);
        yield* TestClock.adjust("8 days");
        const relogin = yield* signIn(yield* handledApi(NameraApi), email);
        const fresh = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${relogin.cookie.value}`, origin: "http://admin.test" },
        });
        expect(
          (yield* fresh.platformInvitation.accept({
            payload: { token: expiredToken },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        const repository = yield* Repository;
        expect(
          yield* repository.auth.platform.pendingForEmail(email, yield* DateTime.now),
        ).toBeUndefined();
        expect(third.acceptedAt).toBeNull();
      }),
  );

  it.effect("protects the owner and transfers ownership atomically", () =>
    Effect.gen(function* () {
      yield* resetPlatformTest;
      const owner = yield* platformIdentity();
      const operator = yield* platformIdentity("next-owner@example.com", "operator");
      expect(
        (yield* owner.client.platform.removeMember({
          params: { id: owner.member.id },
          responseMode: "response-only",
        })).status,
      ).toBe(403);
      expect(
        (yield* owner.client.platform.changeRole({
          params: { id: owner.member.id },
          payload: { role: "viewer" },
          responseMode: "response-only",
        })).status,
      ).toBe(403);
      const results = yield* Effect.all(
        [0, 1].map(() =>
          owner.client.platform.transferOwnership({
            payload: { memberId: operator.member.id },
            responseMode: "response-only",
          }),
        ),
        { concurrency: "unbounded" },
      );
      expect(results.filter((r) => r.status < 300)).toHaveLength(1);
      const members = yield* operator.client.platform.members();
      expect(members.filter((m) => m.role === "owner")).toHaveLength(1);
      expect((yield* owner.client.platform.members({ responseMode: "response-only" })).status).toBe(
        403,
      );
      const bootstrap = yield* bootstrapPlatformOwner(testEmail("platform-owner@example.com")).pipe(
        Effect.result,
      );
      expect(Result.isFailure(bootstrap)).toBe(true);
    }),
  );

  it.effect("keeps removed members historical and requires explicit owner reactivation", () =>
    Effect.gen(function* () {
      yield* resetPlatformTest;
      const owner = yield* platformIdentity();
      const viewer = yield* platformIdentity("removed@example.com", "viewer");
      yield* owner.client.platform.removeMember({ params: { id: viewer.member.id } });
      expect((yield* viewer.client.platform.me({ responseMode: "response-only" })).status).toBe(
        403,
      );
      expect(
        (yield* owner.client.platform.invite({
          payload: { email: viewer.user.email, role: "operator" },
          responseMode: "response-only",
        })).status,
      ).toBe(403);
      yield* owner.client.platform.changeStatus({
        params: { id: viewer.member.id },
        payload: { status: "active" },
      });
      expect((yield* viewer.client.platform.me()).member.role).toBe("viewer");
    }),
  );
});
