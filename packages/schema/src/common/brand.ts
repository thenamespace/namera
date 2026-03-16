import { Schema } from "effect";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const SmartAccountId = Schema.String.pipe(
  Schema.brand("SmartAccountId"),
);
export type SmartAccountId = typeof SmartAccountId.Type;

export const SessionKeyId = Schema.String.pipe(Schema.brand("SessionKeyId"));
export type SessionKeyId = typeof SessionKeyId.Type;
