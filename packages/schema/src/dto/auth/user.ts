import { Schema, Struct } from "effect";

import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  Session,
  User,
} from "@/auth";
import { MetadataName } from "@/common";

export const UpdateUserRequest = Schema.Struct({
  name: MetadataName,
  image: Schema.NullOr(Schema.String),
});
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
