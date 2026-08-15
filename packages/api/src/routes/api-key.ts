import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi";

import {
  ApiKeyCreationError,
  ApiKeyNotFoundError,
  SessionKeyNotFoundError,
} from "@namera-ai/protocol";
import {
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  GetApiKeyRequest,
  GetApiKeyResponse,
  ListApiKeysResponse,
  RevokeApiKeyRequest,
  RevokeApiKeyResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class ApiKeyGroup extends HttpApiGroup.make("apiKey")
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateApiKeyRequest,
      success: CreateApiKeyResponse.pipe(HttpApiSchema.status("Created")),
      error: [ApiKeyCreationError, SessionKeyNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Create an API key with session-key grants"),
    HttpApiEndpoint.get("list", "/", {
      success: ListApiKeysResponse,
      error: CommonErrors,
    }).annotate(OpenApi.Summary, "List API keys for the active organization"),
    HttpApiEndpoint.get("get", "/:apiKeyId", {
      params: GetApiKeyRequest,
      success: GetApiKeyResponse,
      error: [ApiKeyNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Get an API key and its authorized session keys"),
    HttpApiEndpoint.post("revoke", "/:apiKeyId/revoke", {
      params: RevokeApiKeyRequest,
      success: RevokeApiKeyResponse,
      error: [ApiKeyNotFoundError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Revoke an API key and all of its session-key grants"),
  )
  .annotate(OpenApi.Description, "Organization API keys and session-key grants")
  .middleware(Authorization)
  .prefix("/api-keys") {}
