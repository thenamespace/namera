import { Schema } from "effect";

import { ActorId, OrganizationId, SessionKeyGrantId, SessionKeyId } from "#/common/index";
import { createInsertSchema } from "#/model/helpers";

export const SessionKeyGrant = Schema.Struct({
  id: SessionKeyGrantId,
  organizationId: OrganizationId,
  actorId: ActorId,
  sessionKeyId: SessionKeyId,
  grantedByActorId: ActorId,
  revokedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
  revokedByActorId: Schema.NullOr(ActorId),
  createdAt: Schema.DateTimeUtcFromDate,
});

export const SessionKeyGrantInsert = createInsertSchema(
  SessionKeyGrant,
  "organizationId",
  "actorId",
  "sessionKeyId",
  "grantedByActorId",
);

export type SessionKeyGrant = typeof SessionKeyGrant.Type;
export type SessionKeyGrantInsert = typeof SessionKeyGrantInsert.Type;
