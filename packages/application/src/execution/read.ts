import { Effect } from "effect";

import { Repository, type ExecutionListView } from "@namera-ai/database";
import {
  ExecutionNotFoundError,
  ExecutionSubmissionNotFoundError,
  type ActorId,
  type ExecutionId,
  type ExecutionSubmissionId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type { ExecutionResponse, GetExecutionSubmissionResponse } from "@namera-ai/protocol/dto";

const executionPageSize = 50;

export type ExecutionActivityView = ExecutionListView;

export interface ExecutionListResult {
  readonly items: ReadonlyArray<ExecutionListView>;
  readonly nextCursor: ExecutionId | null;
}

export interface ExecutionReadApplication {
  readonly getSubmission: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly submissionId: ExecutionSubmissionId;
  }) => Effect.Effect<GetExecutionSubmissionResponse, ExecutionSubmissionNotFoundError>;
  readonly get: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly executionId: ExecutionId;
  }) => Effect.Effect<ExecutionResponse, ExecutionNotFoundError>;
  readonly list: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly cursor?: ExecutionId;
  }) => Effect.Effect<ExecutionListResult>;
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
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly executionId: ExecutionId;
    }) {
      const execution = yield* input.actorId === undefined
        ? repository.core.execution.findById(input.executionId, input.organizationId)
        : repository.core.execution.findByIdForActor(
            input.executionId,
            input.organizationId,
            input.actorId,
          );
      if (execution === undefined) {
        return yield* new ExecutionNotFoundError({ code: "EXECUTION_NOT_FOUND" });
      }
      return execution;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  const list = Effect.fn("application.execution.list")(
    function* (input: {
      readonly organizationId: OrganizationId;
      readonly actorId?: ActorId;
      readonly cursor?: ExecutionId;
    }) {
      const rows = yield* input.actorId === undefined
        ? repository.core.execution.findForOrganization({
            organizationId: input.organizationId,
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
            limit: executionPageSize + 1,
          })
        : repository.core.execution.findForActor({
            organizationId: input.organizationId,
            actorId: input.actorId,
            ...(input.cursor === undefined ? {} : { cursor: input.cursor }),
            limit: executionPageSize + 1,
          });
      const items = rows.slice(0, executionPageSize);
      return {
        items,
        nextCursor: rows.length > executionPageSize ? (items.at(-1)?.execution.id ?? null) : null,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { getSubmission, get, list } satisfies ExecutionReadApplication;
});
