import { Schema, Struct } from "effect";

import { User } from "#/model/index";

export const GetUserRequest = Schema.Void;
export const GetUserResponse = User.mapFields(
  Struct.pick(["id", "email", "emailVerified", "metadata", "lastLoginAt"]),
);

export const UpdateUserRequest = User.mapFields(Struct.pick(["metadata"]));
export const UpdateUserResponse = GetUserResponse;

export type GetUserRequest = typeof GetUserRequest.Type;
export type GetUserResponse = typeof GetUserResponse.Type;
export type UpdateUserRequest = typeof UpdateUserRequest.Type;
export type UpdateUserResponse = typeof UpdateUserResponse.Type;
