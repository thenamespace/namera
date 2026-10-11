import { expect, layer } from "@effect/vitest";
import { Effect, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Application, Audit } from "@namera-ai/application";
import { Database, Repository } from "@namera-ai/database";
import { ExecutionSubmissionId, SessionKeyGrantId, WalletId } from "@namera-ai/protocol";
import { AnalyticsCollection } from "@namera-ai/telemetry/analytics/collection";
import { AnalyticsDeliveryError, ProductAnalytics } from "@namera-ai/telemetry/analytics/server";

import { deliverNextMilestone } from "#/workers/analytics";

import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("committed product milestones", (it) => {
  it.effect(
    "captures signup and workspace creation through the real auth flow without credentials",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        yield* signIn(client, testEmail("analytics-signup@example.com"));
        const jobs = yield* (yield* Database).query.analyticsJob.findMany();
        expect(jobs.map((job) => job.payload?.event)).toEqual(
          expect.arrayContaining(["signup_completed", "workspace_created", "login_completed"]),
        );
        const serialized = JSON.stringify(jobs.map((job) => job.payload));
        expect(serialized).not.toContain("@example");
        expect(serialized).not.toMatch(/ipAddress|userAgent|token|password|secret/);
      }).pipe(Effect.provideService(AnalyticsCollection, "enabled")),
  );

  it.effect("does not queue opted-out activity or duplicate waitlist joins", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const app = yield* Application;
      yield* app.waitlist.join(testEmail("analytics-private@example.com"));
      expect(yield* (yield* Database).query.analyticsJob.findMany()).toHaveLength(0);
      yield* app.waitlist
        .join(testEmail("analytics-public@example.com"))
        .pipe(Effect.provideService(AnalyticsCollection, "enabled"));
      yield* app.waitlist
        .join(testEmail("analytics-public@example.com"))
        .pipe(Effect.provideService(AnalyticsCollection, "enabled"));
      expect(yield* (yield* Database).query.analyticsJob.findMany()).toHaveLength(1);
    }),
  );

  it.effect("background outcomes require original opt-in and never export signed payloads", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("analytics-worker@example.com"));
      const current = yield* client.session.currentUser();
      const audit = yield* Audit;
      const membership = yield* (yield* Repository).auth.member.findActiveMembership(
        current.user.id,
        current.organization.id,
      );
      if (!membership) return yield* Effect.die("Expected membership");
      const scope = {
        organizationId: current.organization.id,
        actorId: membership.organizationMember.actorId,
      };
      const submissionId = Schema.decodeSync(ExecutionSubmissionId)(
        "01900000-0000-7000-8000-000000000001",
      );
      const prepared = {
        ...scope,
        event: "execution.prepared" as const,
        resourceType: "execution-submission" as const,
        resourceId: submissionId,
        data: {
          version: 1 as const,
          namespace: "eip155" as const,
          chainId: "eip155:84532" as const,
          sessionKeyGrantId: Schema.decodeSync(SessionKeyGrantId)(
            "01900000-0000-7000-8000-000000000002",
          ),
        },
      };
      const failed = {
        ...scope,
        event: "execution.failed" as const,
        resourceType: "execution-submission" as const,
        resourceId: submissionId,
        data: {
          version: 1 as const,
          namespace: "eip155" as const,
          chainId: "eip155:84532" as const,
          stage: "receipt" as const,
        },
      };
      yield* audit.organization(prepared);
      yield* audit
        .organization(failed)
        .pipe(Effect.provideService(AnalyticsCollection, "background"));
      expect(yield* (yield* Database).query.analyticsJob.findMany()).toHaveLength(0);
      yield* audit
        .organization(prepared)
        .pipe(Effect.provideService(AnalyticsCollection, "enabled"));
      yield* audit
        .organization(failed)
        .pipe(Effect.provideService(AnalyticsCollection, "background"));
      const jobs = yield* (yield* Database).query.analyticsJob.findMany();
      expect(jobs.map((job) => job.payload?.event)).toEqual([
        "execution_prepared",
        "execution_failed",
      ]);
      expect(jobs[1]?.payload).toMatchObject({
        distinctId: current.user.id,
        properties: { chain_id: "eip155:84532", actor_kind: "user", stage: "receipt" },
      });
      expect(jobs[0]?.payload?.properties).not.toHaveProperty("sessionKeyGrantId");
    }),
  );

  it.effect("activates a workspace once across repeated completed signatures", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("analytics-activation@example.com"));
      const current = yield* client.session.currentUser();
      const membership = yield* (yield* Repository).auth.member.findActiveMembership(
        current.user.id,
        current.organization.id,
      );
      if (!membership) return yield* Effect.die("Expected membership");
      const audit = yield* Audit;
      const signature = {
        organizationId: current.organization.id,
        actorId: membership.organizationMember.actorId,
        event: "signature.created" as const,
        resourceType: "wallet" as const,
        resourceId: Schema.decodeSync(WalletId)("01900000-0000-7000-8000-000000000003"),
        data: {
          version: 1 as const,
          namespace: "eip155" as const,
          chainId: "eip155:84532" as const,
          type: "message" as const,
          sessionKeyGrantId: Schema.decodeSync(SessionKeyGrantId)(
            "01900000-0000-7000-8000-000000000002",
          ),
        },
      };
      yield* audit.organization(signature);
      yield* audit.organization(signature);
      const jobs = yield* (yield* Database).query.analyticsJob.findMany();
      expect(jobs.filter((job) => job.payload?.event === "signing_completed")).toHaveLength(2);
      const activated = jobs.filter((job) => job.payload?.event === "workspace_activated");
      expect(activated).toHaveLength(1);
      expect(activated[0]?.payload?.distinctId).toBe(current.user.id);
    }).pipe(Effect.provideService(AnalyticsCollection, "enabled")),
  );

  it.effect(
    "retries a provider outage without losing the committed event or changing delivery UUID",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const repository = (yield* Repository).jobs.analytics;
        yield* repository.enqueue("worker-fixture", {
          event: "waitlist_joined",
          distinctId: "waitlist:fixture",
          properties: {},
        });
        const delivered: string[] = [];
        const provider = ProductAnalytics.of({
          enabled: true,
          capture: () => Effect.void,
          deliver: (event) => {
            delivered.push(event.id);
            return delivered.length === 1 ? Effect.fail(new AnalyticsDeliveryError()) : Effect.void;
          },
        });
        yield* deliverNextMilestone().pipe(Effect.provideService(ProductAnalytics, provider));
        expect((yield* (yield* Database).query.analyticsJob.findFirst())?.deliveredAt).toBeNull();
        yield* TestClock.adjust("1 minute");
        yield* deliverNextMilestone().pipe(Effect.provideService(ProductAnalytics, provider));
        expect(delivered).toHaveLength(2);
        expect(delivered[1]).toBe(delivered[0]);
        expect((yield* (yield* Database).query.analyticsJob.findFirst())?.payload).toBeNull();
      }),
  );
});
