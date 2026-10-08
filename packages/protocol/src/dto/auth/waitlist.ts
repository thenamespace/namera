import { Schema } from "effect";

import { Email } from "#/common/index";

export const JoinWaitlistRequest = Schema.Struct({
  email: Email.check(Schema.isMaxLength(254)),
}).annotate({ identifier: "JoinWaitlistRequest" });
export const JoinWaitlistResponse = Schema.Struct({ accepted: Schema.Literal(true) }).annotate({
  identifier: "JoinWaitlistResponse",
  description: "Same response for new and previously submitted addresses",
});
