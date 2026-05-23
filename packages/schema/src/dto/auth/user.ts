import { Schema, Struct } from "effect";

import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  Session,
  User,
} from "@/auth";

export const UpdateUserRequest = User.mapFields(Struct.pick(["name", "image"]));
export const UpdateUserResponse = User;

export const AuthenticatedUserResponse = Schema.Struct({
  user: User,
  session: Session.mapFields(Struct.omit(["token"])),
  organization: Schema.optional(Organization),
  member: Schema.optional(
    OrganizationMember.mapFields(Struct.omit(["roleId"])).mapFields(
      Struct.assign({
        role: OrganizationRole,
      }),
    ),
  ),
});

export type UpdateUserRequest = typeof UpdateUserRequest.Type;
export type UpdateUserResponse = typeof UpdateUserResponse.Type;
export type AuthenticatedUserResponse = typeof AuthenticatedUserResponse.Type;
