import { DateTime, Duration, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";
import { BetaInviteRequiredError } from "@namera-ai/protocol";
import type { RequestMagicLinkRequest, RequestMagicLinkResponse } from "@namera-ai/protocol/dto";
import { magicLinkRequestDuration, magicLinkRequests } from "@namera-ai/telemetry";

import { AuthConfig } from "#/auth/config";

const accepted: RequestMagicLinkResponse = {
  message: "If this email can sign in, we sent a sign-in email.",
};

export interface RequestMagicLinkApplication {
  readonly request: (
    input: RequestMagicLinkRequest,
  ) => Effect.Effect<RequestMagicLinkResponse, BetaInviteRequiredError>;
}

export const makeRequestMagicLinkApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const emailJobs = yield* EmailJobs;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const request = Effect.fn("application.magicLink.request")(
    function* (input: RequestMagicLinkRequest) {
      yield* Metric.update(magicLinkRequests, 1);
      const now = yield* DateTime.now;
      const existingUser = yield* repository.auth.user.findByEmail(input.email);
      const invite =
        input.inviteCode === undefined
          ? undefined
          : yield* repository.auth.betaInvite.findByHmac(
              yield* crypto.hmac({ purpose: cryptoPurpose.betaInvite, value: input.inviteCode }),
            );
      const usableInvite =
        invite &&
        invite.redeemedAt === null &&
        invite.revokedAt === null &&
        DateTime.toEpochMillis(invite.expiresAt) > DateTime.toEpochMillis(now) &&
        (invite.email === null || invite.email === input.email)
          ? invite
          : undefined;
      if (input.inviteCode !== undefined && !usableInvite)
        return yield* new BetaInviteRequiredError({ code: "INVITE_REQUIRED_OR_UNAVAILABLE" });
      // Keep the request enumeration-resistant. Verification remains authoritative.
      if (config.inviteRequired && !existingUser && !usableInvite) return accepted;
      const current = yield* repository.auth.verification.findPendingByIdentifier({
        purpose: config.magicLink.purpose,
        identifier: input.email,
        now,
        maxAttempts: config.magicLink.maximumAttempts,
      });
      if (
        current &&
        DateTime.toEpochMillis(now) - DateTime.toEpochMillis(current.createdAt) <
          Duration.toMillis(config.magicLink.resendCooldown)
      ) {
        return accepted;
      }

      const [token, code] = yield* Effect.all([
        crypto.randomToken(config.magicLink.tokenBytes),
        crypto.randomCode(config.magicLink.codeDigits),
      ]);
      const [tokenHash, codeHmac] = yield* Effect.all([
        crypto.hash({ purpose: cryptoPurpose.magicLinkToken, value: token }),
        crypto.hmac({ purpose: cryptoPurpose.magicLinkCode, value: code }),
      ]);
      const returnTo = input.returnTo;
      const returnUrl =
        returnTo === undefined ? undefined : new URL(returnTo, config.dashboardPublicOrigin);
      const allowedReturnTo =
        returnUrl !== undefined &&
        config.returnTo.allowedPrefixes.some(
          (prefix) => returnUrl.pathname === prefix || returnUrl.pathname.startsWith(`${prefix}/`),
        )
          ? `${returnUrl.pathname}${returnUrl.search}${returnUrl.hash}`
          : undefined;
      yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.auth.verification.revokePending({
            purpose: config.magicLink.purpose,
            identifier: input.email,
            revokedAt: now,
          });
          const verification = yield* repository.auth.verification.create({
            purpose: config.magicLink.purpose,
            identifier: input.email,
            data: {
              ...(allowedReturnTo === undefined ? {} : { returnTo: allowedReturnTo }),
              ...(!existingUser && usableInvite ? { betaInviteId: usableInvite.id } : {}),
            },
            tokenHash,
            codeHmac,
            expiresAt: DateTime.addDuration(now, config.magicLink.timeToLive),
          });
          if (verification === undefined) return false;

          const magicLinkUrl = new URL("/auth/verify", config.dashboardPublicOrigin);
          magicLinkUrl.searchParams.set("id", verification.id);
          magicLinkUrl.searchParams.set("token", token);

          yield* emailJobs.enqueue({
            type: "magic-link",
            to: input.email,
            idempotencyKey: verification.id,
            expiresAt: verification.expiresAt,
            variables: {
              magicLinkUrl: magicLinkUrl.toString(),
              code,
              expiresInMinutes: Math.ceil(Duration.toMillis(config.magicLink.timeToLive) / 60_000),
            },
          });
          return true;
        }),
      );
      yield* Effect.logInfo("magic_link.requested");
      return accepted;
    },
    Effect.catch((error) =>
      error instanceof BetaInviteRequiredError ? Effect.fail(error) : Effect.die(error),
    ),
    Effect.trackDuration(magicLinkRequestDuration),
  );

  return { request } satisfies RequestMagicLinkApplication;
});
