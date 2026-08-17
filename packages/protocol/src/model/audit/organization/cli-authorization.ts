import { Schema } from "effect";

import { OAuthAuthorizationId, OAuthClientId, SessionKeyId } from "#/common/index";

const CliAuthorizationResource = {
  resourceType: Schema.Literal("cli-authorization"),
  resourceId: OAuthAuthorizationId,
};

export const CliAuthorizationApprovedEventData = Schema.Struct({
  event: Schema.Literal("cli_authorization.approved"),
  ...CliAuthorizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    clientId: OAuthClientId,
    deviceName: Schema.NonEmptyString,
    sessionKeyIds: Schema.Array(SessionKeyId),
  }),
});

export const CliAuthorizationRevokedEventData = Schema.Struct({
  event: Schema.Literal("cli_authorization.revoked"),
  ...CliAuthorizationResource,
  data: Schema.Struct({
    version: Schema.Literal(1),
    clientId: OAuthClientId,
    deviceName: Schema.NonEmptyString,
    sessionKeyIds: Schema.Array(SessionKeyId),
  }),
});
