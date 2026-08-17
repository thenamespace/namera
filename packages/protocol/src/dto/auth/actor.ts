import { Schema } from "effect";

import { ActorId, ApiKeyId, OrganizationId } from "#/common/index";
import { ApiKeyMetadata, SessionKey, SessionKeyGrant } from "#/model/index";

import { GetSessionResponse, GetUserResponse } from "./core/index.js";
import {
  GetOrganizationMemberResponse,
  GetOrganizationResponse,
  GetOrganizationRoleResponse,
} from "./organization/index.js";

const GrantedActorFields = {
  actorId: ActorId,
  organizationId: OrganizationId,
  grants: Schema.Array(
    Schema.Struct({
      grant: SessionKeyGrant,
      sessionKey: SessionKey,
    }),
  ),
};

// API keys, MCP authorizations, and future machine credentials all execute
// through the same durable actor grants. Provider-specific credential details
// stay outside this shared application boundary.
export const GrantedActorData = Schema.Struct(GrantedActorFields).annotate({
  identifier: "GrantedActorData",
});

export const UserActorData = Schema.Struct({
  actorId: ActorId,
  session: GetSessionResponse,
  user: GetUserResponse,
  organization: GetOrganizationResponse,
  member: GetOrganizationMemberResponse,
  role: GetOrganizationRoleResponse,
}).annotate({ identifier: "UserActorData" });

export const UserActor = Schema.Struct({
  type: Schema.Literal("user"),
  data: UserActorData,
}).annotate({ identifier: "UserActor" });

export const ApiKeyActorData = Schema.Struct({
  ...GrantedActorFields,
  apiKey: Schema.Struct({
    id: ApiKeyId,
    metadata: ApiKeyMetadata,
    keyStart: Schema.String,
    expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
    lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
    createdAt: Schema.DateTimeUtcFromDate,
  }),
}).annotate({ identifier: "ApiKeyActorData" });

export const ApiKeyActor = Schema.Struct({
  type: Schema.Literal("api-key"),
  data: ApiKeyActorData,
}).annotate({ identifier: "ApiKeyActor" });

export const CurrentActorResponse = Schema.Union([UserActor, ApiKeyActor]).annotate({
  identifier: "CurrentActorResponse",
});

export type UserActorData = typeof UserActorData.Type;
export type UserActor = typeof UserActor.Type;
export type GrantedActorData = typeof GrantedActorData.Type;
export type ApiKeyActorData = typeof ApiKeyActorData.Type;
export type ApiKeyActor = typeof ApiKeyActor.Type;
export type CurrentActorResponse = typeof CurrentActorResponse.Type;
