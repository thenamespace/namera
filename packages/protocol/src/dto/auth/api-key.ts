import { Schema } from "effect";

import { ActorId, ApiKeyId, OrganizationId, SessionKeyId } from "#/common/index";
import { ApiKeyMetadata, TimestampFields } from "#/model/index";

export const ApiKeyResponse = Schema.Struct({
  id: ApiKeyId,
  organizationId: OrganizationId,
  actorId: ActorId,
  metadata: ApiKeyMetadata,
  keyStart: Schema.NonEmptyString,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  ...TimestampFields,
}).annotate({
  identifier: "ApiKeyResponse",
  description: "An organization API key without its secret credential",
});

export const CreateApiKeyRequest = Schema.Struct({
  metadata: ApiKeyMetadata,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  sessionKeyIds: Schema.Array(SessionKeyId).check(
    Schema.isMinLength(1, { message: "At least one session key grant is required" }),
  ),
}).annotate({
  identifier: "CreateApiKeyRequest",
  description: "Create an API-key actor with initial session-key grants",
});

export const CreateApiKeyResponse = Schema.Struct({
  apiKey: ApiKeyResponse,
  key: Schema.NonEmptyString,
}).annotate({
  identifier: "CreateApiKeyResponse",
  description: "A newly created API key and its one-time secret credential",
});

export const GetApiKeyRequest = Schema.Struct({
  apiKeyId: ApiKeyId,
}).annotate({ identifier: "GetApiKeyRequest" });

export const GetApiKeyResponse = ApiKeyResponse.annotate({ identifier: "GetApiKeyResponse" });

export const ListApiKeysResponse = Schema.Array(ApiKeyResponse).annotate({
  identifier: "ListApiKeysResponse",
});

export type ApiKeyResponse = typeof ApiKeyResponse.Type;
export type CreateApiKeyRequest = typeof CreateApiKeyRequest.Type;
export type CreateApiKeyResponse = typeof CreateApiKeyResponse.Type;
export type GetApiKeyRequest = typeof GetApiKeyRequest.Type;
export type GetApiKeyResponse = typeof GetApiKeyResponse.Type;
export type ListApiKeysResponse = typeof ListApiKeysResponse.Type;
