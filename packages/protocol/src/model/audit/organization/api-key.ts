import { Schema } from "effect";

import { ApiKeyId, SessionKeyId } from "#/common/index";

export const ApiKeyCreatedEventData = Schema.Struct({
  event: Schema.Literal("api_key.created"),
  resourceType: Schema.Literal("api-key"),
  resourceId: ApiKeyId,
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionKeyIds: Schema.Array(SessionKeyId),
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
