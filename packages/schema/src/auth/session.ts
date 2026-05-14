import { Schema } from "effect";

import { createInsertSchema, createUpdateSchema } from "@/helpers";

import { OrganizationId, SessionId, UserId } from "../common";

export const Session = Schema.Struct({
  id: SessionId,
  ipAddress: Schema.NullOr(Schema.String),
  token: Schema.String,
  userId: UserId,
  activeOrganizationId: OrganizationId,
  userAgent: Schema.NullOr(Schema.String),
  expiresAt: Schema.Date,
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});

export const SessionUpdate = createUpdateSchema(Session);
export const SessionInsert = createInsertSchema(Session, "token", "userId");

export type Session = typeof Session.Type;
export type SessionUpdate = typeof SessionUpdate.Type;
export type SessionInsert = typeof SessionInsert.Type;
