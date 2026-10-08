import { DateTime, Duration, Effect } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { betaInvite, betaInviteEvent, Database } from "@namera-ai/database";
import type { Email } from "@namera-ai/protocol";

// Seed admission-only tests without requiring an administrative session.
export const seedBetaInvite = Effect.fnUntraced(function* (email: Email | null = null) {
  const db = yield* Database;
  const crypto = yield* CryptoService;
  const code = yield* crypto.randomString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
  const now = yield* DateTime.now;
  const rows = yield* db
    .insert(betaInvite)
    .values({
      codeHmac: yield* crypto.hmac({ purpose: cryptoPurpose.betaInvite, value: code }),
      email,
      createdAt: DateTime.toDateUtc(now),
      expiresAt: DateTime.toDateUtc(DateTime.addDuration(now, Duration.days(7))),
    })
    .returning();
  const invite = rows[0];
  if (!invite) return yield* Effect.die("Missing seeded invite");
  yield* db.insert(betaInviteEvent).values({ inviteId: invite.id, event: "created" });
  return { id: invite.id, code };
});
