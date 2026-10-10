import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/http-api";

import {
  SessionKeyCreationError,
  SessionKeyNotFoundError,
  WalletNotFoundError,
  SessionKeyOperationError,
  BillingLimitExceededError,
} from "@namera-ai/protocol";
import {
  CreateSessionKeyRequest,
  CreateSessionKeyResponse,
  GetSessionKeyRequest,
  GetSessionKeyResponse,
  ListSessionKeysForOrganizationResponse,
  ListSessionKeysForWalletRequest,
  ListSessionKeysForWalletResponse,
  RevokeSessionKeyRequest,
  RevokeSessionKeyResponse,
  PrepareSessionKeyOperationRequest,
  PrepareSessionKeyOperationResponse,
  CompleteSessionKeyOperationRequest,
  SessionKeyOperationResponse,
  GetSessionKeyOperationRequest,
  GetActiveSessionKeyOperationRequest,
  GetActiveSessionKeyOperationResponse,
  PrepareManagedSessionKeyOperationResponse,
  ApproveManagedSessionKeyOperationRequest,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SessionKeyGroup extends HttpApiGroup.make("sessionKey")
  .add(
    HttpApiEndpoint.post("prepareManagedOperation", "/operations/managed/prepare", {
      payload: PrepareSessionKeyOperationRequest,
      success: PrepareManagedSessionKeyOperationResponse,
      error: [SessionKeyOperationError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Prepare a session installation or removal for a 1Claw account"),
    HttpApiEndpoint.post("approveManagedOperation", "/operations/managed/approve", {
      payload: ApproveManagedSessionKeyOperationRequest,
      success: SessionKeyOperationResponse,
      error: [SessionKeyOperationError, BillingLimitExceededError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Approve the stored session operation with its 1Claw owner"),
    HttpApiEndpoint.get("getActiveOperation", "/installations/:installationId/operations/:kind", {
      params: GetActiveSessionKeyOperationRequest,
      success: GetActiveSessionKeyOperationResponse,
      error: [SessionKeyOperationError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Recover an active installation or removal approval"),
    HttpApiEndpoint.get("getOperation", "/operations/:operationId", {
      params: GetSessionKeyOperationRequest,
      success: SessionKeyOperationResponse,
      error: [SessionKeyOperationError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Read the status of a stored owner approval operation"),
    HttpApiEndpoint.post("completeOperation", "/operations/complete", {
      payload: CompleteSessionKeyOperationRequest,
      success: SessionKeyOperationResponse,
      error: [SessionKeyOperationError, BillingLimitExceededError, ...CommonErrors],
    }).annotate(
      OpenApi.Summary,
      "Approve a stored session operation with the wallet owner passkey",
    ),
    HttpApiEndpoint.post("prepareOperation", "/operations/prepare", {
      payload: PrepareSessionKeyOperationRequest,
      success: PrepareSessionKeyOperationResponse,
      error: [SessionKeyOperationError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Prepare a passkey-approved session installation or removal"),
    HttpApiEndpoint.post("create", "/", {
      payload: CreateSessionKeyRequest,
      success: CreateSessionKeyResponse.pipe(HttpApiSchema.status("Created")),
      error: [
        WalletNotFoundError,
        SessionKeyCreationError,
        BillingLimitExceededError,
        ...CommonErrors,
      ],
    }).annotate(OpenApi.Summary, "Create a session key"),
    HttpApiEndpoint.get("listForOrganization", "/", {
      success: ListSessionKeysForOrganizationResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List session keys for the active organization"),
    HttpApiEndpoint.get("listForWallet", "/wallets/:walletId", {
      params: ListSessionKeysForWalletRequest,
      success: ListSessionKeysForWalletResponse,
      error: [WalletNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "List session keys for a wallet"),
    HttpApiEndpoint.get("get", "/:sessionKeyId", {
      params: GetSessionKeyRequest,
      success: GetSessionKeyResponse,
      error: [SessionKeyNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get a session key"),
    HttpApiEndpoint.post("revoke", "/:sessionKeyId/revoke", {
      params: RevokeSessionKeyRequest,
      success: RevokeSessionKeyResponse,
      error: [SessionKeyNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Revoke a session key and all of its active grants"),
  )
  .annotate(
    OpenApi.Description,
    "Local session signers, onchain installations and additional API policies",
  )
  .middleware(Authorization)
  .prefix("/session-keys") {}
