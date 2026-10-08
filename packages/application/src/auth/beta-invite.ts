import { DateTime, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import type { CreateBetaInvitesRequest, ListBetaInvitesRequest } from "@namera-ai/protocol/dto";
import { betaInviteTransitions } from "@namera-ai/telemetry";

import { AuthConfig } from "./config.js";

export const makeBetaInviteApplication = Effect.gen(function* () {
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const crypto = yield* CryptoService;
  const config = yield* AuthConfig;
  const create = Effect.fn("application.betaInvite.create")(function* (
    input: CreateBetaInvitesRequest,
    actorMemberId?: string,
  ) {
    const createdAt = yield* DateTime.now;
    const expiresAt = DateTime.add(createdAt, { days: input.expiresInDays ?? 7 });
    const result = yield* transaction.run(
      Effect.gen(function* () {
        const invites = [];
        for (let index = 0; index < input.count; index++) {
          // Collisions never overwrite or reactivate an older invite.
          let saved;
          for (let attempt = 0; attempt < 5; attempt++) {
            const code = yield* crypto.randomString("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
            const codeHmac = yield* crypto.hmac({ purpose: cryptoPurpose.betaInvite, value: code });
            const invite = yield* repository.auth.betaInvite.create({
              codeHmac,
              email: input.email ?? null,
              createdAt,
              expiresAt,
            });
            if (invite) {
              yield* repository.auth.betaInvite.appendEvent(invite.id, "created");
              if (actorMemberId)
                yield* repository.auth.platform.appendEvent(actorMemberId, {
                  version: 1,
                  type: "beta-invite.created",
                  inviteId: invite.id,
                });
              const url = new URL("/auth", config.dashboardPublicOrigin);
              // Query values are stripped by browser telemetry; codes must not enter route names.
              url.searchParams.set("invite", code);
              saved = { id: invite.id, code, url: url.toString(), expiresAt };
              break;
            }
          }
          if (!saved)
            return yield* Effect.die(new Error("Unable to allocate a unique beta invite"));
          invites.push(saved);
        }
        return { invites };
      }),
    );
    yield* Metric.update(
      Metric.withAttributes(betaInviteTransitions, { result: "created" }),
      result.invites.length,
    );
    return result;
  }, Effect.orDie);
  const revoke = Effect.fn("application.betaInvite.revoke")(function* (
    id: string,
    actorMemberId?: string,
  ) {
    const result = yield* transaction.run(
      Effect.gen(function* () {
        const revoked = yield* repository.auth.betaInvite.revoke(id, yield* DateTime.now);
        if (revoked) yield* repository.auth.betaInvite.appendEvent(id, "revoked");
        if (revoked && actorMemberId)
          yield* repository.auth.platform.appendEvent(actorMemberId, {
            version: 1,
            type: "beta-invite.revoked",
            inviteId: id,
          });
        return { revoked: revoked !== undefined };
      }),
    );
    if (result.revoked)
      yield* Metric.update(Metric.withAttributes(betaInviteTransitions, { result: "revoked" }), 1);
    return result;
  }, Effect.orDie);
  const list = Effect.fn("application.betaInvite.list")(function* (input: ListBetaInvitesRequest) {
    const limit = input.limit ?? 50;
    const rows = yield* repository.auth.betaInvite.list({
      ...input,
      limit,
      now: yield* DateTime.now,
      ...(input.email === undefined ? {} : { email: input.email.trim().toLowerCase() }),
    });
    const entries = rows.slice(0, limit);
    return { entries, nextCursor: rows.length > limit ? (entries.at(-1)?.id ?? null) : null };
  }, Effect.orDie);
  return { create, list, revoke };
});
