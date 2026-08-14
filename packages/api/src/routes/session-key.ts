import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi";

import {
  SessionKeyCreationError,
  SessionKeyNotFoundError,
  WalletNotFoundError,
} from "@namera-ai/protocol";
import {
  CreateSessionKeyRequest,
  CreateSessionKeyResponse,
  GetSessionKeyRequest,
  GetSessionKeyResponse,
  ListSessionKeysForOrganizationResponse,
  ListSessionKeysForWalletRequest,
  ListSessionKeysForWalletResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class SessionKeyGroup extends HttpApiGroup.make("sessionKey")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateSessionKeyRequest,
      success: CreateSessionKeyResponse.pipe(HttpApiSchema.status("Created")),
      error: [WalletNotFoundError, SessionKeyCreationError, ...CommonErrors],
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
  )
  .annotate(OpenApi.Description, "Immutable offchain session keys and policies")
  .middleware(Authorization)
  .prefix("/session-keys") {}
