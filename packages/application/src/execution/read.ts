import { Effect } from "effect";

import { Repository } from "@namera-ai/database";
import {
  ExecutionNotFoundError,
  ExecutionSubmissionNotFoundError,
  type ActorId,
  type ExecutionId,
  type ExecutionSubmissionId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type {
  ExecutionResponse,
  GetExecutionSubmissionResponse,
  ListExecutionsResponse,
} from "@namera-ai/protocol/dto";

const executionPageSize = 50;

export interface ExecutionReadApplication {
  readonly getSubmission: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly submissionId: ExecutionSubmissionId;
  }) => Effect.Effect<GetExecutionSubmissionResponse, ExecutionSubmissionNotFoundError>;
  readonly get: (
    organizationId: OrganizationId,
    executionId: ExecutionId,
  ) => Effect.Effect<ExecutionResponse, ExecutionNotFoundError>;
  readonly list: (input: {
    readonly organizationId: OrganizationId;
    readonly cursor?: ExecutionId;
  }) => Effect.Effect<ListExecutionsResponse>;
}

export const makeExecutionReadApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const getSubmission = Effect.fn("application.execution.getSubmission")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId: ActorId;
      readonly submissionId: ExecutionSubmissionId;
    }) {
      const submission = yield* repository.core.executionSubmission.findByIdForActor(
        input.submissionId,
        input.organizationId,
        input.actorId,
      );
      if (submission === undefined) {
        return yield* new ExecutionSubmissionNotFoundError({
          code: "EXECUTION_SUBMISSION_NOT_FOUND",
        });
      }
      if (submission.status === "failed") {
        return {
          namespace: submission.namespace,
          status: "failed" as const,
          submissionId: submission.id,
        };
      }
      if (submission.status === "confirmed") {
        const execution = yield* repository.core.execution.findBySubmissionId(
          submission.id,
          input.organizationId,
        );
        if (execution === undefined) {
          return yield* new ExecutionSubmissionNotFoundError({
            code: "EXECUTION_SUBMISSION_NOT_FOUND",
          });
        }
        return {
          namespace: submission.namespace,
          status: "confirmed" as const,
          submissionId: submission.id,
          execution,
        };
      }
      return {
        namespace: submission.namespace,
        status: "submitted" as const,
        submissionId: submission.id,
        userOperationHash: submission.data.signedExecution?.userOperationHash ?? null,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const get = Effect.fn("application.execution.get")(
    function* (organizationId: OrganizationId, executionId: ExecutionId) {
      const execution = yield* repository.core.execution.findById(executionId, organizationId);
      if (execution === undefined) {
        return yield* new ExecutionNotFoundError({ code: "EXECUTION_NOT_FOUND" });
      }
      return execution;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const list = Effect.fn("application.execution.list")(
    function* (input: { readonly organizationId: OrganizationId; readonly cursor?: ExecutionId }) {
      const rows = yield* repository.core.execution.findForOrganization({
        ...input,
        limit: executionPageSize + 1,
      });
      const items = rows.slice(0, executionPageSize);
      return {
        items,
        nextCursor: rows.length > executionPageSize ? (items.at(-1)?.id ?? null) : null,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { getSubmission, get, list } satisfies ExecutionReadApplication;
});
