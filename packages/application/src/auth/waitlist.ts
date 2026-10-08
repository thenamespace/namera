import { Effect, Metric } from "effect";

import { Repository } from "@namera-ai/database";
import type { Email } from "@namera-ai/protocol";
import { waitlistJoins } from "@namera-ai/telemetry";

export const makeWaitlistApplication = Effect.gen(function* () {
  const repository = (yield* Repository).auth.waitlist;

  const join = Effect.fn("application.waitlist.join")(function* (email: Email) {
    const created = yield* repository.join(email);
    if (created) yield* Metric.update(waitlistJoins, 1);
    return { accepted: true as const };
  }, Effect.orDie);

  return { join };
});
