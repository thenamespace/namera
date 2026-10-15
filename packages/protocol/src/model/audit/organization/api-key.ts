import { Schema } from "effect";

import { ApiKeyId, SessionKeyId } from "#/common/index";

import { ApiKeyPermission, ApiKeyPasskeyOrigin } from "../../auth/core/api-key.js";

export const ApiKeyCreatedEventData = Schema.Struct({
  event: Schema.Literal("api_key.created"),
  resourceType: Schema.Literal("api-key"),
  resourceId: ApiKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionKeyIds: Schema.Array(SessionKeyId),
    permissions: Schema.optionalKey(Schema.Array(ApiKeyPermission)),
    passkeyOrigins: Schema.optionalKey(Schema.Array(ApiKeyPasskeyOrigin)),
  }),
});

export const ApiKeyRevokedEventData = Schema.Struct({
  event: Schema.Literal("api_key.revoked"),
  resourceType: Schema.Literal("api-key"),
  resourceId: ApiKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionKeyIds: Schema.Array(SessionKeyId),
  }),
});
