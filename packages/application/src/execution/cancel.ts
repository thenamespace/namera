import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  ExecutionError,
  type ActorId,
  type OrganizationId,
  type ExecutionSubmissionId,
} from "@namera-ai/protocol";
import type { CancelExecutionResponse } from "@namera-ai/protocol/dto";

import { makeExecutionLifecycle } from "./lifecycle.js";

export const makeCancelExecution = Effect.gen(function* () {
  const repository = yield* Repository;
  const lifecycle = yield* makeExecutionLifecycle;
  return Effect.fn("application.execution.cancel")(function* (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly submissionId: ExecutionSubmissionId;
  }): Effect.fn.Return<CancelExecutionResponse, ExecutionError> {
    const submission = yield* repository.core.executionSubmission
      .findByIdForActor(input.submissionId, input.organizationId, input.actorId)
      .pipe(Effect.orDie);
    if (!submission) return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    const sessionKey = yield* repository.core.sessionKey
      .findById(submission.sessionKeyId, input.organizationId)
      .pipe(Effect.orDie);
    if (!sessionKey) return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    const cancelled = yield* lifecycle
      .release({ ...input, sessionKey, stage: "cancel" })
      .pipe(
        Effect.catchTag("DatabaseError", Effect.die),
        Effect.catchTag("EvmPolicyError", Effect.die),
      );
    if (!cancelled) return yield* new ExecutionError({ code: "EXECUTION_UNAVAILABLE" });
    return { namespace: "eip155", submissionId: submission.id, status: "cancelled" };
  });
});
