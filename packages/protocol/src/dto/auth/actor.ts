import { Schema } from "effect";

import { GetSessionResponse, GetUserResponse } from "./core/index.js";
import {
  GetOrganizationMemberResponse,
  GetOrganizationResponse,
  GetOrganizationRoleResponse,
} from "./organization/index.js";

export const UserActorData = Schema.Struct({
  session: GetSessionResponse,
  user: GetUserResponse,
  organization: GetOrganizationResponse,
  member: GetOrganizationMemberResponse,
  role: GetOrganizationRoleResponse,
});

export const UserActor = Schema.Struct({
  type: Schema.Literal("user"),
  data: UserActorData,
});

export const CurrentActorResponse = Schema.Union([UserActor]);

export type UserActorData = typeof UserActorData.Type;
export type UserActor = typeof UserActor.Type;
export type CurrentActorResponse = typeof CurrentActorResponse.Type;
