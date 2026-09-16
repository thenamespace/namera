import { Schema } from "effect";

import { Email } from "#/common/index";

export const WaitlistStatus = Schema.Literals(["pending", "completed"]);
export type WaitlistStatus = typeof WaitlistStatus.Type;

export const WaitlistEntry = Schema.Struct({
  id: Schema.String.check(Schema.isUUID()),
  email: Email,
  status: WaitlistStatus,
  createdAt: Schema.DateTimeUtcFromDate,
  updatedAt: Schema.DateTimeUtcFromDate,
  completedAt: Schema.NullOr(Schema.DateTimeUtcFromDate),
});
export type WaitlistEntry = typeof WaitlistEntry.Type;
