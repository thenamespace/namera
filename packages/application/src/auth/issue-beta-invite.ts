import { Effect, type DateTime } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import type { Email } from "@namera-ai/protocol";

import { AuthConfig } from "./config.js";

// Call inside the caller's transaction so issuance and its business transition commit together.
export const makeIssueBetaInvite = Effect.gen(function* () {
  const repository = yield* Repository;
  const crypto = yield* CryptoService;
  const config = yield* AuthConfig;
  return Effect.fn("application.betaInvite.issue")(function* (input: {
    readonly actorMemberId: string;
    readonly email: Email | null;
    readonly createdAt: DateTime.Utc;
    readonly expiresAt: DateTime.Utc;
  }) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = yield* crypto.randomString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
      const codeHmac = yield* crypto.hmac({ purpose: cryptoPurpose.betaInvite, value: code });
      const invite = yield* repository.auth.betaInvite.create({
        codeHmac,
        email: input.email,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      });
      if (!invite) continue;
      yield* repository.auth.betaInvite.appendEvent(invite.id, "created");
      yield* repository.auth.platform.appendEvent(input.actorMemberId, {
        version: 1,
        type: "beta-invite.created",
        inviteId: invite.id,
      });
      const url = new URL("/auth", config.dashboardPublicOrigin);
      url.searchParams.set("invite", code);
      return { id: invite.id, code, url: url.toString(), expiresAt: input.expiresAt };
    }
    return yield* Effect.die(new Error("Unable to allocate a unique beta invite"));
  });
});
