import { Schema, Struct } from "effect";

import { SessionId, UserEventId, UserId } from "#/common/index";
import { AuditEventCommon } from "#/model/audit/common";

export const UserEventCommon = Schema.Struct({
  id: UserEventId,
  userId: UserId,
  sessionId: Schema.NullOr(SessionId),
}).mapFields(Struct.assign(AuditEventCommon.fields));
