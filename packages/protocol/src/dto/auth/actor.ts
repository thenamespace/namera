import { Schema } from "effect";

import { ActorId, ApiKeyId, OrganizationId } from "#/common/index";
import { ApiKeyMetadata, SessionKey, SessionKeyGrant } from "#/model/index";

import { GetSessionResponse, GetUserResponse } from "./core/index.js";
import {
  GetOrganizationMemberResponse,
  GetOrganizationResponse,
  GetOrganizationRoleResponse,
} from "./organization/index.js";

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
  actorId: ActorId,
  organizationId: OrganizationId,
  apiKey: Schema.Struct({
    id: ApiKeyId,
    metadata: ApiKeyMetadata,
    keyStart: Schema.String,
    expiresAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
    lastUsedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
    createdAt: Schema.DateTimeUtcFromDate,
  }),
  grants: Schema.Array(
    Schema.Struct({
      grant: SessionKeyGrant,
      sessionKey: SessionKey,
    }),
  ),
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
export type ApiKeyActorData = typeof ApiKeyActorData.Type;
export type ApiKeyActor = typeof ApiKeyActor.Type;
export type CurrentActorResponse = typeof CurrentActorResponse.Type;
