import { Schema } from "effect";

import { SessionId } from "#/common/index";

export const SessionRevokedEventData = Schema.Struct({
  event: Schema.Literal("session.revoked"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    sessionId: SessionId,
  }),
});

export const OtherSessionsRevokedEventData = Schema.Struct({
  event: Schema.Literal("session.others_revoked"),
  data: Schema.Struct({
    version: Schema.Literal(1),
    count: Schema.Int,
  }),
});
