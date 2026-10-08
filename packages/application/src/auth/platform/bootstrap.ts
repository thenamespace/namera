import { Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { PlatformAuthError, type Email } from "@namera-ai/protocol";

// Explicit operator command only; never called during startup or exposed over HTTP.
export const bootstrapPlatformOwner = Effect.fn("application.platform.bootstrapOwner")(function* (
  email: Email,
) {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  return yield* transaction.run(
    Effect.gen(function* () {
      const store = repository.auth.platform;
      yield* store.lockTeam();
      if (yield* store.findOwner())
        return yield* new PlatformAuthError({ code: "OWNER_ALREADY_EXISTS" });
      const user = yield* repository.auth.user.findByEmail(email);
      if (!user?.emailVerified)
        return yield* new PlatformAuthError({ code: "VERIFIED_USER_REQUIRED" });
      const member = yield* store.createMember({ userId: user.id, role: "owner" });
      yield* store.appendEvent(null, {
        version: 1,
        type: "owner.bootstrapped",
        memberId: member.id,
      });
      return member;
    }),
  );
});
