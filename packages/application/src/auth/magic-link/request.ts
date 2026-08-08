import { DateTime, Duration, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { EmailService } from "@namera-ai/emails";
import type { RequestMagicLinkRequest, RequestMagicLinkResponse } from "@namera-ai/protocol/dto";
import {
  magicLinkEmailResults,
  magicLinkRequestDuration,
  magicLinkRequests,
} from "@namera-ai/telemetry";

import { AuthConfig } from "#/auth/config";
import { cryptoPurpose } from "#/crypto/data";
import { CryptoService } from "#/crypto/layer";

const accepted: RequestMagicLinkResponse = {
  message: "If this email can sign in, we sent a sign-in email.",
};

export interface RequestMagicLinkApplication {
  readonly request: (input: RequestMagicLinkRequest) => Effect.Effect<RequestMagicLinkResponse>;
}

export const makeRequestMagicLinkApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const email = yield* EmailService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const request = Effect.fn("Application.magicLink.request")(
    function* (input: RequestMagicLinkRequest) {
      yield* Metric.update(magicLinkRequests, 1);
      const now = yield* DateTime.now;
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
      const verification = yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.auth.verification.revokePending({
            purpose: config.magicLink.purpose,
            identifier: input.email,
            revokedAt: now,
          });
          return yield* repository.auth.verification.create({
            purpose: config.magicLink.purpose,
            identifier: input.email,
            data: input.returnTo === undefined ? {} : { returnTo: input.returnTo },
            tokenHash,
            codeHmac,
            expiresAt: DateTime.addDuration(now, config.magicLink.timeToLive),
          });
        }),
      );

      const magicLinkUrl = new URL("/auth/magic-link", config.dashboardPublicOrigin);
      magicLinkUrl.searchParams.set("id", verification.id);
      magicLinkUrl.searchParams.set("token", token);

      yield* email
        .send({
          type: "magic-link",
          to: input.email,
          idempotencyKey: verification.id,
          variables: {
            magicLinkUrl: magicLinkUrl.toString(),
            code,
            expiresInMinutes: Math.ceil(Duration.toMillis(config.magicLink.timeToLive) / 60_000),
          },
        })
        .pipe(
          Effect.tap(() => Metric.update(magicLinkEmailResults, "success")),
          Effect.catchTag("EmailError", () =>
            Effect.gen(function* () {
              yield* repository.auth.verification.revokePending({
                purpose: config.magicLink.purpose,
                identifier: input.email,
                revokedAt: now,
              });
              yield* Metric.update(magicLinkEmailResults, "failure");
              yield* Effect.logWarning("magic_link.email_failed");
            }),
          ),
        );
      yield* Effect.logInfo("magic_link.requested");
      return accepted;
    },
    Effect.orDie,
    Effect.trackDuration(magicLinkRequestDuration),
  );

  return { request } satisfies RequestMagicLinkApplication;
});
