import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { SessionId, UserId } from "../common";

export const Session = Schema.Struct({
  id: SessionId,
  ipAddress: Schema.NullOr(Schema.String),
  token: Schema.String,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
  userId: UserId,
  userAgent: Schema.NullOr(Schema.String),
  expiresAt: Schema.Date,
});

export const SessionUpdate = createUpdateSchema(Session);
export const SessionInsert = createInsertSchema(Session, "token", "userId");

export type Session = typeof Session.Type;
export type SessionUpdate = typeof SessionUpdate.Type;
export type SessionInsert = typeof SessionInsert.Type;
