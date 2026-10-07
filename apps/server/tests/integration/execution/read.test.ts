import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import { TestEvmExecution } from "@namera-ai/evm";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import {
  createExecutionFixture,
  executeFixture,
  executionFixture,
  queueExecution,
} from "./fixture.js";

layer(executionFixture.layer)("execution read routes", (it) => {
  it.effect("only lets the creating API-key actor read its submission", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const testExecution = yield* TestEvmExecution;
      yield* testExecution.setReceiptMode("pending");
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("execution-read-owner@example.com"));
      const fixture = yield* createExecutionFixture(client, "read");
      const otherApiKey = yield* client.apiKey.create({
        payload: {
          metadata: { version: 1, name: "Other agent" },
          durationDays: 7,
          sessionKeyIds: [fixture.sessionKey.id],
        },
      });

      yield* setAuthToken();
      yield* setApiKey(fixture.apiKey.key);
      const executed = yield* queueExecution(client, {
        headers: { "idempotency-key": "submission-owner" },
        payload: {
          namespace: "eip155",
          walletId: fixture.wallet.id,
          sessionKeyId: fixture.sessionKey.id,
          chainId: "eip155:1",
          calls: [{ to: fixture.wallet.address, value: 0n, data: "0x" }],
        },
      });
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).execution.reconcile();
      const submission = yield* client.execution.getSubmission({
        params: { submissionId: executed.submissionId },
      });
      expect(submission.status).toBe("submitted");

      yield* setApiKey(otherApiKey.key);
      expect(
        yield* client.execution
          .getSubmission({ params: { submissionId: executed.submissionId } })
          .pipe(Effect.flip),
      ).toMatchObject({
        _tag: "ExecutionSubmissionNotFoundError",
        code: "EXECUTION_SUBMISSION_NOT_FOUND",
      });

      yield* setApiKey();
      yield* setAuthToken(owner.cookie.value);
      expect(
        yield* client.execution
          .getSubmission({ params: { submissionId: executed.submissionId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "Forbidden" });
      yield* testExecution.setReceiptMode("immediate");
    }),
  );

  it.effect(
    "gets confirmed executions and paginates organization history",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail("execution-list-owner@example.com"));
        const fixture = yield* createExecutionFixture(client, "list");
        const otherApiKey = yield* client.apiKey.create({
          payload: {
            metadata: { version: 1, name: "Other history reader" },
            durationDays: 7,
            sessionKeyIds: [fixture.sessionKey.id],
          },
        });

        yield* setAuthToken();
        yield* setApiKey(fixture.apiKey.key);
        const executions = yield* Effect.forEach(
          Array.from({ length: 51 }, (_, index) => index),
          (index) =>
            executeFixture(client, fixture, `list-${index}`).pipe(
              Effect.tap(() => Effect.flatMap(Application, (app) => app.billing.reconcile())),
            ),
          { concurrency: 1 },
        );
        const confirmed = executions.filter((execution) => execution.status === "confirmed");
        expect(confirmed).toHaveLength(51);
        const firstExecution = confirmed[0];
        if (firstExecution === undefined) return yield* Effect.die("Expected an execution");

        const actorPage = yield* client.execution.list({ query: {} });
        expect(actorPage.items).toHaveLength(50);
        expect(
          (yield* client.execution.get({ params: { executionId: firstExecution.executionId } }))
            .execution.id,
        ).toBe(firstExecution.executionId);

        yield* setApiKey(otherApiKey.key);
        const sharedPage = yield* client.execution.list({ query: {} });
        expect(sharedPage).toEqual(actorPage);
        expect(
          (yield* client.execution.get({ params: { executionId: firstExecution.executionId } }))
            .execution.id,
        ).toBe(firstExecution.executionId);
        if (sharedPage.nextCursor === null) return yield* Effect.die("Expected shared cursor");
        expect(
          (yield* client.execution.list({ query: { cursor: sharedPage.nextCursor } })).items,
        ).toHaveLength(1);

        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        const detail = yield* client.execution.get({
          params: { executionId: firstExecution.executionId },
        });
        expect(detail.execution.executionSubmissionId).toBe(firstExecution.submissionId);
        expect(detail.actor).toMatchObject({
          type: "api-key",
          apiKey: { id: fixture.apiKey.apiKey.id, metadata: { name: "Agent list" } },
        });

        const emptyScope = yield* createExecutionFixture(client, "empty-scope");
        yield* setAuthToken();
        yield* setApiKey(emptyScope.apiKey.key);
        expect(
          yield* client.execution.list({ query: { cursor: firstExecution.executionId } }),
        ).toMatchObject({ items: [], nextCursor: null });
        expect(
          yield* client.execution.list({ query: { sessionKeyId: fixture.sessionKey.id } }),
        ).toMatchObject({ items: [], nextCursor: null });
        expect(
          yield* client.execution
            .get({ params: { executionId: firstExecution.executionId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_NOT_FOUND" });
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        const walletPage = yield* client.execution.list({
          query: { walletId: fixture.wallet.id },
        });
        expect(walletPage.items).toHaveLength(50);
        expect(walletPage.items.every((item) => item.wallet.id === fixture.wallet.id)).toBe(true);
        const sessionKeyPage = yield* client.execution.list({
          query: { sessionKeyId: fixture.sessionKey.id },
        });
        expect(sessionKeyPage.items).toHaveLength(50);
        expect(
          sessionKeyPage.items.every((item) => item.sessionKey.id === fixture.sessionKey.id),
        ).toBe(true);
        expect(
          yield* client.execution.list({
            query: {
              walletId: fixture.wallet.id,
              sessionKeyId: emptyScope.sessionKey.id,
            },
          }),
        ).toMatchObject({ items: [], nextCursor: null });

        const firstPage = yield* client.execution.list({ query: {} });
        expect(firstPage.items).toHaveLength(50);
        expect(firstPage.items[0]).toMatchObject({
          actorType: "api-key",
          sessionKey: { id: fixture.sessionKey.id },
          wallet: { id: fixture.wallet.id },
          details: { namespace: "eip155" },
        });
        expect(Object.keys(firstPage.items[0] ?? {}).toSorted()).toEqual([
          "actorType",
          "details",
          "sessionKey",
          "wallet",
        ]);
        expect(firstPage.nextCursor).not.toBeNull();
        if (firstPage.nextCursor === null) return yield* Effect.die("Expected a next cursor");
        const secondPage = yield* client.execution.list({
          query: { cursor: firstPage.nextCursor },
        });
        expect(secondPage.items).toHaveLength(1);
        expect(secondPage.nextCursor).toBeNull();
        expect(
          new Set([...firstPage.items, ...secondPage.items].map(({ details }) => details.id)).size,
        ).toBe(51);
      }),
    // Builds 51 real HTTP prepare/complete/worker journeys. Allow shared-runner
    // contention without increasing deadlines for ordinary route tests.
    { timeout: 60_000 },
  );

  it.effect(
    "lets a new CLI authorization read granted key history and removes access with the grant",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const api = yield* makeTestApiClient;
        const owner = yield* signIn(api, testEmail("cli-history@example.com"));
        const fixture = yield* createExecutionFixture(api, "cli-history");
        yield* setAuthToken();
        yield* setApiKey(fixture.apiKey.key);
        const executed = yield* executeFixture(api, fixture, "before-cli-login");
        if (executed.status !== "confirmed")
          return yield* Effect.die("Expected confirmed execution");
        yield* setApiKey();
        yield* setAuthToken(owner.cookie.value);
        const app = yield* Application;
        const started = yield* app.oauth.device.start({
          clientId: "namera-cli",
          resource: "http://api.test",
          scopes: ["execution:read"],
          deviceName: "History reader",
          cliVersion: "1.0.3",
          platform: "test",
        });
        const claim = yield* api.oauth.getOAuthDeviceAuthorization({
          query: { userCode: started.userCode },
        });
        yield* api.oauth.approveOAuthDeviceAuthorization({
          payload: {
            deviceAuthorizationId: claim.id,
            organizationId: owner.actor.organization.id,
            sessionKeyIds: [fixture.sessionKey.id],
          },
        });
        const token = yield* app.oauth.device.exchange({
          clientId: "namera-cli",
          resource: "http://api.test",
          deviceCode: started.deviceCode,
        });
        yield* api.apiKey.revoke({ params: { apiKeyId: fixture.apiKey.apiKey.id } });
        yield* setAuthToken();
        const cli = yield* handledApi(NameraApi, {
          headers: { authorization: `Bearer ${token.accessToken}` },
        });
        expect(
          (yield* cli.execution.list({ query: {} })).items.map(({ details }) => details.id),
        ).toEqual([executed.executionId]);
        expect(
          (yield* cli.execution.get({ params: { executionId: executed.executionId } })).execution
            .id,
        ).toBe(executed.executionId);
        expect(
          yield* cli.execution
            .getSubmission({ params: { submissionId: executed.submissionId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_SUBMISSION_NOT_FOUND" });

        const reader = yield* cli.session.currentActor();
        if (reader.type !== "cli") return yield* Effect.die("Expected CLI actor");
        const repository = yield* Repository;
        // Isolate grant removal from key or credential revocation at the HTTP read boundary.
        yield* repository.core.sessionKeyGrant.revokeActiveForActor(
          owner.actor.organization.id,
          reader.data.actorId,
          owner.actor.actorId,
          yield* DateTime.now,
        );
        expect(yield* cli.execution.list({ query: {} })).toMatchObject({
          items: [],
          nextCursor: null,
        });
        expect(
          yield* cli.execution
            .get({ params: { executionId: executed.executionId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_NOT_FOUND" });
        yield* repository.core.sessionKeyGrant.insertMany([
          {
            organizationId: owner.actor.organization.id,
            actorId: reader.data.actorId,
            sessionKeyId: fixture.sessionKey.id,
            grantedByActorId: owner.actor.actorId,
          },
        ]);
        expect(
          (yield* cli.execution.list({ query: {} })).items.map(({ details }) => details.id),
        ).toEqual([executed.executionId]);

        yield* setAuthToken(owner.cookie.value);
        yield* api.sessionKey.revoke({ params: { sessionKeyId: fixture.sessionKey.id } });
        yield* setAuthToken();
        expect(yield* cli.execution.list({ query: {} })).toMatchObject({
          items: [],
          nextCursor: null,
        });
        expect(
          yield* cli.execution.list({ query: { cursor: executed.executionId } }),
        ).toMatchObject({ items: [], nextCursor: null });
        expect(
          yield* cli.execution
            .get({ params: { executionId: executed.executionId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_NOT_FOUND" });

        yield* signIn(api, testEmail("other-history-tenant@example.com"));
        const outsider = yield* createExecutionFixture(api, "other-tenant");
        yield* setAuthToken();
        yield* setApiKey(outsider.apiKey.key);
        expect(
          yield* api.execution.list({ query: { sessionKeyId: fixture.sessionKey.id } }),
        ).toMatchObject({ items: [], nextCursor: null });
        expect(
          yield* api.execution
            .get({ params: { executionId: executed.executionId } })
            .pipe(Effect.flip),
        ).toMatchObject({ code: "EXECUTION_NOT_FOUND" });
      }),
  );
});
