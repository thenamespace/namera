import { expect, layer } from "@effect/vitest";
import { Effect, Exit, Schema } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { CreateFeedbackRequest } from "@namera-ai/protocol/dto";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";
import { platformIdentity } from "../../fixtures/platform.js";

const payload = Schema.decodeUnknownSync(CreateFeedbackRequest)({
  category: "feature_request",
  data: { version: 1, message: "  Copy policies between networks.  " },
  pagePath: "/templates",
});
const setup = Effect.gen(function* () {
  yield* resetTestState();
  const loginClient = yield* makeTestApiClient;
  const author = yield* signIn(
    loginClient,
    testEmail(`feedback-${crypto.randomUUID()}@example.com`),
  );
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
  });
  const owner = yield* platformIdentity();
  return { client, author, owner, db: yield* Database, repository: yield* Repository };
});

layer(TestServerLayer)("feedback", (it) => {
  it.effect("persists versioned data with trusted identity and an ID-only audit event", () =>
    Effect.gen(function* () {
      const { client, author, owner, db, repository } = yield* setup;
      const created = yield* client.feedback.create({ payload });
      const entry = yield* owner.client.adminFeedback.get({ params: created });
      expect(entry).toMatchObject({
        ...created,
        category: "feature_request",
        status: "new",
        pagePath: "/templates",
        data: { version: 1, message: "Copy policies between networks." },
        userId: author.actor.user.id,
        organizationId: author.actor.organization.id,
        user: { email: author.actor.user.email },
        organization: { metadata: author.actor.organization.metadata },
      });
      expect(yield* db.query.feedback.findMany()).toHaveLength(1);
      const events = (yield* repository.audit.user.findForUser(author.actor.user.id)).filter(
        (event) => event.event === "feedback.created",
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toEqual({ version: 1, feedbackId: created.id });
      expect(
        (yield* client.adminFeedback.list({ query: {}, responseMode: "response-only" })).status,
      ).toBe(403);
    }),
  );

  it.effect("lets every active platform role read but only the owner change status", () =>
    Effect.gen(function* () {
      const { client, owner, db } = yield* setup;
      const created = yield* client.feedback.create({ payload });
      const operator = yield* platformIdentity("feedback-operator@example.com", "operator");
      const viewer = yield* platformIdentity("feedback-viewer@example.com", "viewer");
      for (const identity of [owner, operator, viewer]) {
        expect((yield* identity.client.adminFeedback.list({ query: {} })).entries).toHaveLength(1);
        expect((yield* identity.client.adminFeedback.get({ params: created })).id).toBe(created.id);
      }
      for (const identity of [operator, viewer]) {
        expect(
          (yield* identity.client.adminFeedback.updateStatus({
            params: created,
            payload: { status: "completed" },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
      }
      for (let attempt = 0; attempt < 2; attempt++) {
        expect(
          (yield* owner.client.adminFeedback.updateStatus({
            params: created,
            payload: { status: "completed" },
          })).status,
        ).toBe("completed");
      }
      expect(
        (yield* db.query.platformEvent.findMany()).filter(
          (event) => event.data.type === "feedback.status-changed",
        ),
      ).toMatchObject([
        {
          actorMemberId: owner.member.id,
          data: { feedbackId: created.id, previousStatus: "new", status: "completed" },
        },
      ]);
      yield* owner.client.platform.changeStatus({
        params: { id: operator.member.id },
        payload: { status: "suspended" },
      });
      expect(
        (yield* operator.client.adminFeedback.get({
          params: created,
          responseMode: "response-only",
        })).status,
      ).toBe(403);
    }),
  );

  it.effect("enforces authentication, write origins, and missing-record errors", () =>
    Effect.gen(function* () {
      const { client, owner, author } = yield* setup;
      const created = yield* client.feedback.create({ payload });
      const anonymous = yield* handledApi(NameraApi, { headers: { cookie: "auth-token=invalid" } });
      expect(
        (yield* anonymous.feedback.create({ payload, responseMode: "response-only" })).status,
      ).toBe(401);
      expect(
        (yield* anonymous.adminFeedback.list({ query: {}, responseMode: "response-only" })).status,
      ).toBe(401);
      for (const origin of ["https://evil.test", ""]) {
        const admin = yield* handledApi(NameraApi, {
          headers: { cookie: owner.headers.cookie, origin },
        });
        expect(
          (yield* admin.adminFeedback.updateStatus({
            params: created,
            payload: { status: "closed" },
            responseMode: "response-only",
          })).status,
        ).toBe(403);
        const user = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${author.cookie.value}`, origin },
        });
        expect(
          (yield* user.feedback.create({ payload, responseMode: "response-only" })).status,
        ).toBe(403);
      }
      const missing = { id: "00000000-0000-4000-8000-000000000001" };
      expect(
        (yield* owner.client.adminFeedback.get({ params: missing, responseMode: "response-only" }))
          .status,
      ).toBe(404);
      expect(
        (yield* owner.client.adminFeedback.updateStatus({
          params: missing,
          payload: { status: "completed" },
          responseMode: "response-only",
        })).status,
      ).toBe(404);
    }),
  );

  it.effect(
    "filters and paginates without duplicates, including submissions without organization context",
    () =>
      Effect.gen(function* () {
        const { author, owner, repository } = yield* setup;
        for (let index = 0; index < 26; index++) {
          yield* repository.core.feedback.create({
            ...payload,
            userId: author.actor.user.id,
            organizationId: null,
          });
        }
        const first = yield* owner.client.adminFeedback.list({
          query: { category: "feature_request", status: "new" },
        });
        expect(first.entries).toHaveLength(25);
        expect(first.entries[0]?.organization).toBeNull();
        const second = yield* owner.client.adminFeedback.list({
          query: first.nextCursor ? { cursor: first.nextCursor } : {},
        });
        expect(second.entries).toHaveLength(1);
        expect(second.nextCursor).toBeNull();
        expect(new Set([...first.entries, ...second.entries].map((entry) => entry.id)).size).toBe(
          26,
        );
        expect(
          (yield* owner.client.adminFeedback.list({ query: { category: "bug" } })).entries,
        ).toHaveLength(0);
        expect(
          (yield* owner.client.adminFeedback.list({ query: { status: "completed" } })).entries,
        ).toHaveLength(0);
      }),
  );

  it.effect("rolls back submission and status changes if their audit cannot persist", () =>
    Effect.gen(function* () {
      const { client, owner, db } = yield* setup;
      yield* db.execute(
        "ALTER TABLE audit.user_events ADD CONSTRAINT test_feedback_audit_failure CHECK (event <> 'feedback.created')",
      );
      const failed = yield* client.feedback
        .create({ payload })
        .pipe(
          Effect.exit,
          Effect.ensuring(
            db
              .execute("ALTER TABLE audit.user_events DROP CONSTRAINT test_feedback_audit_failure")
              .pipe(Effect.orDie),
          ),
        );
      expect(Exit.isFailure(failed)).toBe(true);
      expect(yield* db.query.feedback.findMany()).toHaveLength(0);
      const created = yield* client.feedback.create({ payload });
      yield* db.execute(
        "ALTER TABLE audit.platform_events ADD CONSTRAINT test_feedback_status_failure CHECK (data->>'type' <> 'feedback.status-changed')",
      );
      const update = yield* owner.client.adminFeedback
        .updateStatus({ params: created, payload: { status: "completed" } })
        .pipe(
          Effect.exit,
          Effect.ensuring(
            db
              .execute(
                "ALTER TABLE audit.platform_events DROP CONSTRAINT test_feedback_status_failure",
              )
              .pipe(Effect.orDie),
          ),
        );
      expect(Exit.isFailure(update)).toBe(true);
      expect((yield* owner.client.adminFeedback.get({ params: created })).status).toBe("new");
    }),
  );

  it.effect("bounds submissions and rejects unsupported versions and sensitive URL context", () =>
    Effect.gen(function* () {
      const { client, db } = yield* setup;
      for (const invalid of [
        { ...payload, data: { version: 2, message: "Future payload" } },
        { ...payload, data: { version: 1, message: "  " } },
        { ...payload, data: { version: 1, message: "x".repeat(5001) } },
        { ...payload, pagePath: "/auth?token=secret" },
        { ...payload, pagePath: "https://example.com" },
        { ...payload, pagePath: "//example.com" },
      ])
        expect(Exit.isFailure(Schema.decodeUnknownExit(CreateFeedbackRequest)(invalid))).toBe(true);
      for (let index = 0; index < 10; index++) yield* client.feedback.create({ payload });
      expect(
        (yield* client.feedback.create({ payload, responseMode: "response-only" })).status,
      ).toBe(429);
      expect(yield* db.query.feedback.findMany()).toHaveLength(10);
    }),
  );
});
