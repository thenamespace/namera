import { Schema } from "effect";

import { OrganizationMember } from "@/database";
import { OrganizationRole } from "@/database/auth/role";

import { GetOrganizationResponse } from "./organization";
import { GetSessionResponse } from "./session";
import { GetUserResponse } from "./user";

export const UserActor = Schema.Struct({
  type: Schema.Literal("user"),
  session: GetSessionResponse,
  user: GetUserResponse,
  organization: GetOrganizationResponse,
  member: OrganizationMember,
  role: OrganizationRole,
});

export const CurrentActorResponse = Schema.Union([UserActor]);

export type UserActor = typeof UserActor.Type;
export type CurrentActorResponse = typeof CurrentActorResponse.Type;
