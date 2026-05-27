import { Schema } from "effect";

import { Organization, OrganizationMember } from "@/database";
import { OrganizationRole } from "@/database/auth/role";

import { GetSessionResponse } from "./session";
import { GetUserResponse } from "./user";

export const UserActor = Schema.Struct({
  type: Schema.Literal("user"),
  session: GetSessionResponse,
  user: GetUserResponse,
  organization: Organization,
  member: OrganizationMember,
  role: OrganizationRole,
});

export const CurrentActor = Schema.Union([UserActor]);

export type UserActor = typeof UserActor.Type;
export type CurrentActor = typeof CurrentActor.Type;
