import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { TestEvmExecution } from "@namera-ai/evm";
import type { ConfirmedEvmExecutionResponse } from "@namera-ai/protocol/dto";

import {
  makeTestApiClient,
  resetTestState,
  setApiKey,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";
import { createExecutionFixture, executeFixture } from "./helpers.js";

layer(TestServerLayer)("execution read routes", (it) => {
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
      const executed = yield* executeFixture(client, fixture.wallet, "submission-owner");
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

  it.effect("gets confirmed executions and paginates organization history", () =>
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
        (index) => executeFixture(client, fixture.wallet, `list-${index}`),
        { concurrency: 1 },
      );
      const confirmed = executions.filter(
        (execution): execution is ConfirmedEvmExecutionResponse => execution.status === "confirmed",
      );
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
      expect(yield* client.execution.list({ query: {} })).toMatchObject({
        items: [],
        nextCursor: null,
      });
      expect(
        yield* client.execution
          .get({ params: { executionId: firstExecution.executionId } })
          .pipe(Effect.flip),
      ).toMatchObject({ _tag: "ExecutionNotFoundError", code: "EXECUTION_NOT_FOUND" });

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
  );
});
