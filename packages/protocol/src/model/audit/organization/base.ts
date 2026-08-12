import { Schema, Struct } from "effect";

import { ActorId, OrganizationEventId, OrganizationId } from "#/common/index";
import { AuditEventCommon } from "#/model/audit/common";

export const OrganizationEventCommon = Schema.Struct({
  id: OrganizationEventId,
  organizationId: OrganizationId,
  actorId: Schema.NullOr(ActorId),
}).mapFields(Struct.assign(AuditEventCommon.fields));
