import { Schema } from "effect";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export const SessionId = Schema.String.pipe(Schema.brand("SessionId"));
export const SmartAccountId = Schema.String.pipe(
  Schema.brand("SmartAccountId"),
);
export const SessionKeyId = Schema.String.pipe(Schema.brand("SessionKeyId"));

export type SessionId = typeof SessionId.Type;
export type UserId = typeof UserId.Type;
export type SmartAccountId = typeof SmartAccountId.Type;
export type SessionKeyId = typeof SessionKeyId.Type;
