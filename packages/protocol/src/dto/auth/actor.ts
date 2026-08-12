import { Schema } from "effect";

import { ActorId } from "#/common/index";

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

export const CurrentActorResponse = Schema.Union([UserActor]).annotate({
  identifier: "CurrentActorResponse",
});

export type UserActorData = typeof UserActorData.Type;
export type UserActor = typeof UserActor.Type;
export type CurrentActorResponse = typeof CurrentActorResponse.Type;
