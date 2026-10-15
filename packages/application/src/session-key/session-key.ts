import { Effect } from "effect";

import {
  type ActorId,
  type ManagementPermissionDeniedError,
  type OrganizationId,
  type SessionKeyCreationError,
  type SessionKeyOperationError,
  type SessionKeyId,
  type SessionKeyOperationId,
  type SessionKeyNotFoundError,
  type WalletId,
  type WalletNotFoundError,
  type BillingLimitExceededError,
} from "@namera-ai/protocol";
import type {
  CreateSessionKeyRequest,
  PrepareSessionKeyOperationRequest,
  PrepareSessionKeyOperationResponse,
  CompleteSessionKeyOperationRequest,
  SessionKeyOperationResponse,
  GetActiveSessionKeyOperationRequest,
  GetActiveSessionKeyOperationResponse,
  PrepareManagedSessionKeyOperationResponse,
  ApproveManagedSessionKeyOperationRequest,
} from "@namera-ai/protocol/dto";

import { makeCancelSessionKeyOperation } from "./cancel-operation.js";
import { makeCompleteSessionKeyOperations } from "./complete-operation.js";
import { makeCreateSessionKey } from "./create.js";
import { makePrepareSessionKeyOperations } from "./prepare-operation.js";
import { makeReadSessionKeys } from "./read.js";
import { makeReconcileSessionKeyOperations } from "./reconcile-operations.js";
import { makeRevokeSessionKey } from "./revoke.js";
import type { SessionKeyView } from "./view.js";

export interface SessionKeyApplication {
  readonly cancelOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly operationId: SessionKeyOperationId;
    readonly allowedKinds: ReadonlyArray<"install" | "uninstall">;
  }) => Effect.Effect<SessionKeyOperationResponse, SessionKeyOperationError>;
  readonly prepareManagedOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: PrepareSessionKeyOperationRequest;
  }) => Effect.Effect<PrepareManagedSessionKeyOperationResponse, SessionKeyOperationError>;
  readonly approveManagedOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly allowedKinds: ReadonlyArray<"install" | "uninstall">;
    readonly request: ApproveManagedSessionKeyOperationRequest;
  }) => Effect.Effect<
    SessionKeyOperationResponse,
    SessionKeyOperationError | BillingLimitExceededError
  >;
  readonly getActiveOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: GetActiveSessionKeyOperationRequest;
    readonly ownOperationsOnly?: boolean;
  }) => Effect.Effect<GetActiveSessionKeyOperationResponse, SessionKeyOperationError>;
  readonly getOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly operationId: SessionKeyOperationId;
    readonly actorId?: ActorId;
  }) => Effect.Effect<SessionKeyOperationResponse, SessionKeyOperationError>;
  readonly reconcileOperations: () => Effect.Effect<number>;
  readonly completeOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly allowedKinds: ReadonlyArray<"install" | "uninstall">;
    readonly request: CompleteSessionKeyOperationRequest;
  }) => Effect.Effect<
    SessionKeyOperationResponse,
    SessionKeyOperationError | BillingLimitExceededError
  >;
  readonly prepareOperation: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: PrepareSessionKeyOperationRequest;
  }) => Effect.Effect<PrepareSessionKeyOperationResponse, SessionKeyOperationError>;
  readonly create: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly request: CreateSessionKeyRequest;
  }) => Effect.Effect<
    SessionKeyView,
    | ManagementPermissionDeniedError
    | WalletNotFoundError
    | SessionKeyCreationError
    | BillingLimitExceededError
  >;
  readonly get: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly sessionKeyId: SessionKeyId;
  }) => Effect.Effect<SessionKeyView, SessionKeyNotFoundError>;
  readonly listForWallet: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
    readonly walletId: WalletId;
  }) => Effect.Effect<ReadonlyArray<SessionKeyView>, WalletNotFoundError>;
  readonly listForOrganization: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId?: ActorId;
  }) => Effect.Effect<ReadonlyArray<SessionKeyView>>;
  readonly revoke: (input: {
    readonly organizationId: OrganizationId;
    readonly actorId: ActorId;
    readonly sessionKeyId: SessionKeyId;
  }) => Effect.Effect<SessionKeyView, SessionKeyNotFoundError | ManagementPermissionDeniedError>;
}

export const makeSessionKeyApplication = Effect.gen(function* () {
  const create = yield* makeCreateSessionKey;
  const read = yield* makeReadSessionKeys;
  const revoke = yield* makeRevokeSessionKey;
  const prepare = yield* makePrepareSessionKeyOperations;
  const complete = yield* makeCompleteSessionKeyOperations;
  const cancelOperation = yield* makeCancelSessionKeyOperation;
  const reconcileOperations = yield* makeReconcileSessionKeyOperations;

  return {
    create,
    ...read,
    revoke,
    ...prepare,
    ...complete,
    reconcileOperations,
    cancelOperation,
  } satisfies SessionKeyApplication;
});

export type { SessionKeyView } from "./view.js";
