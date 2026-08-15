import { Schema, Struct } from "effect";

import { ActorId, OrganizationId } from "#/common/index";
import { TimestampFields } from "#/model/common";

export const ActorType = Schema.Literals(["user", "api-key", "mcp"]);

export const Actor = Schema.Struct({
  id: ActorId,
  organizationId: OrganizationId,
  type: ActorType,
}).mapFields(Struct.assign(TimestampFields));

export const ActorInsert = Schema.Struct({
  organizationId: OrganizationId,
  type: ActorType,
});

export type ActorType = typeof ActorType.Type;
export type Actor = typeof Actor.Type;
export type ActorInsert = typeof ActorInsert.Type;
