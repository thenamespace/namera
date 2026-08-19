import { Effect } from "effect";

import {
  Repository,
  type ExecutionDetailsView as DatabaseExecutionDetailsView,
  type ExecutionListView,
} from "@namera-ai/database";
import {
  ExecutionNotFoundError,
  ExecutionSubmissionNotFoundError,
  type ActorId,
  type ExecutionId,
  type ExecutionSubmissionId,
  type OrganizationId,
} from "@namera-ai/protocol";
import type { GetExecutionSubmissionResponse } from "@namera-ai/protocol/dto";
import type {
  ApiKey,
  OAuthAuthorization,
  OAuthClient,
  OrganizationMember,
  OrganizationRole,
  User,
} from "@namera-ai/protocol/model";

const executionPageSize = 50;

export type ExecutionActivityView = ExecutionListView;

interface ExecutionMemberView {
  readonly organizationMember: OrganizationMember;
  readonly organizationRole: OrganizationRole;
  readonly user: User;
}

export type ExecutionActorDetailsView =
  | {
      readonly type: "user";
      readonly member: ExecutionMemberView;
    }
  | {
      readonly type: "api-key";
      readonly apiKey: ApiKey;
    }
  | {
      readonly type: "mcp" | "cli";
      readonly authorization: OAuthAuthorization;
      readonly client: OAuthClient;
    };

export interface ExecutionDetailsView extends DatabaseExecutionDetailsView {
  readonly actorDetails: ExecutionActorDetailsView;
}

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
  }) => Effect.Effect<ExecutionDetailsView, ExecutionNotFoundError>;
  readonly list: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly cursor?: ExecutionId;
  }) => Effect.Effect<ExecutionListResult>;
}

export const makeExecutionReadApplication = Effect.gen(function* () {
  const repository = yield* Repository;

  const loadActorDetails = Effect.fnUntraced(function* (details: DatabaseExecutionDetailsView) {
    switch (details.actor.type) {
      case "user": {
        const member = (yield* repository.auth.member.findByActorIds(
          details.execution.organizationId,
          [details.actor.id],
        ))[0];
        if (member === undefined)
          return yield* Effect.die("Execution user actor relation is missing");
        return { type: "user", member } as const;
      }
      case "api-key": {
        const apiKey = yield* repository.auth.apiKey.findByActorId(
          details.actor.id,
          details.execution.organizationId,
        );
        if (apiKey === undefined) {
          return yield* Effect.die("Execution API-key actor relation is missing");
        }
        return { type: "api-key", apiKey } as const;
      }
      case "mcp":
      case "cli": {
        const authorization = yield* repository.auth.oauth.authorization.findByActorId(
          details.actor.id,
          details.execution.organizationId,
        );
        if (authorization === undefined || authorization.type !== details.actor.type) {
          return yield* Effect.die("Execution OAuth actor relation is missing");
        }
        const client = yield* repository.auth.oauth.client.findById(authorization.clientId);
        if (client === undefined) {
          return yield* Effect.die("Execution OAuth client relation is missing");
        }
        return { type: details.actor.type, authorization, client } as const;
      }
    }
  });

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
      const details = yield* input.actorId === undefined
        ? repository.core.execution.findDetailsById(input.executionId, input.organizationId)
        : repository.core.execution.findDetailsByIdForActor(
            input.executionId,
            input.organizationId,
            input.actorId,
          );
      if (details === undefined) {
        return yield* new ExecutionNotFoundError({ code: "EXECUTION_NOT_FOUND" });
      }
      return {
        ...details,
        actorDetails: yield* loadActorDetails(details),
      };
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
        nextCursor: rows.length > executionPageSize ? (items.at(-1)?.details.id ?? null) : null,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { getSubmission, get, list } satisfies ExecutionReadApplication;
});
