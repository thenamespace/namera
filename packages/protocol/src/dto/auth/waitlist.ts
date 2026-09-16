import { Schema } from "effect";

import { Email } from "#/common/index";
import { WaitlistEntry, WaitlistStatus } from "#/model/auth/core/waitlist";

export const JoinWaitlistRequest = Schema.Struct({
  email: Email.check(Schema.isMaxLength(254)),
}).annotate({ identifier: "JoinWaitlistRequest" });
export const JoinWaitlistResponse = Schema.Struct({ accepted: Schema.Literal(true) }).annotate({
  identifier: "JoinWaitlistResponse",
  description: "Same response for new and previously submitted addresses",
});
export const ListWaitlistRequest = Schema.Struct({
  limit: Schema.optionalKey(
    Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })),
  ),
  cursor: Schema.optionalKey(Schema.String.check(Schema.isUUID())),
  status: Schema.optionalKey(WaitlistStatus),
  search: Schema.optionalKey(Schema.String.check(Schema.isMaxLength(254))),
}).annotate({ identifier: "ListWaitlistRequest" });
export type ListWaitlistRequest = typeof ListWaitlistRequest.Type;
export const WaitlistEntryResponse = WaitlistEntry.annotate({
  identifier: "WaitlistEntryResponse",
});
export const ListWaitlistResponse = Schema.Struct({
  entries: Schema.Array(WaitlistEntryResponse),
  nextCursor: Schema.NullOr(Schema.String),
}).annotate({ identifier: "ListWaitlistResponse" });
export const UpdateWaitlistRequest = Schema.Struct({ status: WaitlistStatus }).annotate({
  identifier: "UpdateWaitlistRequest",
});
