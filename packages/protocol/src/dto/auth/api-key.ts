import { Schema } from "effect";

import { ActorId, ApiKeyId, OrganizationId, SessionKeyId } from "#/common/index";
import {
  ApiKeyMetadata,
  ApiKeyPermission,
  ApiKeyPasskeyOrigin,
  TimestampFields,
} from "#/model/index";

import { SessionKeySummaryResponse } from "../session-key/index.js";
import { GetOrganizationMemberResponse } from "./organization/member.js";

export const ApiKeyResponse = Schema.Struct({
  id: ApiKeyId,
  organizationId: OrganizationId,
  actorId: ActorId,
  metadata: ApiKeyMetadata,
  permissions: Schema.Array(ApiKeyPermission),
  passkeyOrigins: Schema.Array(ApiKeyPasskeyOrigin),
  keyStart: Schema.NonEmptyString,
  expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  sessionKeys: Schema.Array(SessionKeySummaryResponse),
  creator: GetOrganizationMemberResponse,
  ...TimestampFields,
}).annotate({
  identifier: "ApiKeyResponse",
  description: "An organization API key with its creator and without its secret credential",
});

export const ApiKeyDurationDays = Schema.Int.check(
  Schema.isBetween(
    {
      minimum: 1,
      maximum: 365,
    },
    { message: "API key duration must be between 1 and 365 days" },
  ),
).annotate({
  identifier: "ApiKeyDurationDays",
  description: "Required API key lifetime in days, capped at one year",
});

export const CreateApiKeyRequest = Schema.Struct({
  metadata: ApiKeyMetadata,
  durationDays: ApiKeyDurationDays,
  permissions: Schema.optionalKey(Schema.Array(ApiKeyPermission)),
  passkeyOrigins: Schema.optionalKey(
    Schema.Array(ApiKeyPasskeyOrigin).check(Schema.isMaxLength(20)),
  ),
  sessionKeyIds: Schema.Array(SessionKeyId).check(
    Schema.isMaxLength(100, { message: "At most 100 session key grants are allowed" }),
  ),
})
  .check(
    Schema.makeFilter((request) =>
      request.sessionKeyIds.length > 0 || (request.permissions?.length ?? 0) > 0
        ? undefined
        : {
            path: ["permissions"],
            issue: "Select at least one session grant or management permission",
          },
    ),
  )
  .annotate({
    identifier: "CreateApiKeyRequest",
    description:
      "Create a time-limited API-key actor with explicit workspace management permissions and optional initial session-key grants",
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

export const RevokeApiKeyRequest = Schema.Struct({
  apiKeyId: ApiKeyId,
}).annotate({
  identifier: "RevokeApiKeyRequest",
  description: "Revoke an API key and all of its active session-key grants",
});

export const RevokeApiKeyResponse = ApiKeyResponse.annotate({
  identifier: "RevokeApiKeyResponse",
});

export type ApiKeyResponse = typeof ApiKeyResponse.Type;
export type CreateApiKeyRequest = typeof CreateApiKeyRequest.Type;
export type CreateApiKeyResponse = typeof CreateApiKeyResponse.Type;
export type GetApiKeyRequest = typeof GetApiKeyRequest.Type;
export type GetApiKeyResponse = typeof GetApiKeyResponse.Type;
export type ListApiKeysResponse = typeof ListApiKeysResponse.Type;
export type RevokeApiKeyRequest = typeof RevokeApiKeyRequest.Type;
export type RevokeApiKeyResponse = typeof RevokeApiKeyResponse.Type;
