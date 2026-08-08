import { DateTime, Duration, Effect, Metric } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import { EmailService } from "@namera-ai/emails";
import { MagicLinkError } from "@namera-ai/protocol";
import type {
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  VerifyMagicLinkRequest,
} from "@namera-ai/protocol/dto";
import {
  magicLinkEmailResults,
  magicLinkRequestDuration,
  magicLinkRequests,
  magicLinkVerificationResults,
} from "@namera-ai/telemetry";

import { AuthConfig } from "#/auth/config";
import {
  createOrganizationWithOwner,
  createUserWithPersonalOrganization,
} from "#/auth/organization/helpers";
import { cryptoPurpose } from "#/crypto/data";
import { CryptoService } from "#/crypto/layer";

const accepted: RequestMagicLinkResponse = {
  message: "If this email can sign in, we sent a sign-in email.",
};

export interface VerifyMagicLinkResult {
  readonly sessionToken: string;
  readonly returnTo: string;
}

export interface MagicLinkApplication {
  readonly request: (input: RequestMagicLinkRequest) => Effect.Effect<RequestMagicLinkResponse>;
  readonly verify: (
    input: VerifyMagicLinkRequest,
  ) => Effect.Effect<VerifyMagicLinkResult, MagicLinkError>;
}

const invalidLink = () => new MagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });

export const makeMagicLinkApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const email = yield* EmailService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;

  const requestWorkflow = Effect.fn("Application.magicLink.request")(function* (
    input: RequestMagicLinkRequest,
  ) {
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
  }, Effect.orDie);
  const request = (input: RequestMagicLinkRequest) =>
    requestWorkflow(input).pipe(Effect.trackDuration(magicLinkRequestDuration));

  const verify = Effect.fn("Application.magicLink.verify")(
    function* (input: VerifyMagicLinkRequest) {
      const now = yield* DateTime.now;
      const verification =
        input.type === "token"
          ? yield* repository.auth.verification.findById(input.id)
          : yield* repository.auth.verification.findPendingByIdentifier({
              purpose: config.magicLink.purpose,
              identifier: input.email,
              now,
              maxAttempts: config.magicLink.maximumAttempts,
            });

      if (
        !verification ||
        verification.purpose !== config.magicLink.purpose ||
        verification.consumedAt !== null ||
        verification.revokedAt !== null ||
        DateTime.toEpochMillis(verification.expiresAt) <= DateTime.toEpochMillis(now)
      ) {
        yield* Metric.update(magicLinkVerificationResults, "invalid");
        return yield* invalidLink();
      }

      const matches =
        input.type === "token"
          ? (yield* crypto.hash({
              purpose: cryptoPurpose.magicLinkToken,
              value: input.token,
            })) === verification.tokenHash
          : yield* crypto.verifyHmac({
              purpose: cryptoPurpose.magicLinkCode,
              value: input.code,
              expected: verification.codeHmac,
            });
      if (!matches) {
        if (input.type === "code") {
          const attempted = yield* repository.auth.verification.incrementAttempts({
            verificationId: verification.id,
            now,
            maxAttempts: config.magicLink.maximumAttempts,
          });
          if (attempted && attempted.attempts >= config.magicLink.maximumAttempts) {
            yield* Metric.update(magicLinkVerificationResults, "attempts_exceeded");
            return yield* new MagicLinkError({ code: "TOO_MANY_ATTEMPTS" });
          }
        }
        yield* Metric.update(magicLinkVerificationResults, "invalid");
        return yield* invalidLink();
      }

      const sessionToken = yield* crypto.randomToken(config.session.tokenBytes);
      const sessionTokenHash = yield* crypto.hash({
        purpose: cryptoPurpose.sessionToken,
        value: sessionToken,
      });
      yield* transaction.run(
        Effect.gen(function* () {
          const consumed = yield* repository.auth.verification.consume({
            verificationId: verification.id,
            consumedAt: now,
            maxAttempts: config.magicLink.maximumAttempts,
          });
          if (!consumed) return yield* invalidLink();

          const existingUser = yield* repository.auth.user.findByEmail(verification.identifier);
          const initialized = existingUser
            ? { user: existingUser, organization: undefined }
            : yield* createUserWithPersonalOrganization(repository, verification.identifier).pipe(
                Effect.catchTag("OrganizationError", Effect.die),
              );
          const user = initialized.user;
          yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, now);
          const memberships = yield* repository.auth.member.findMembershipsForUser(user.id);
          const organization =
            initialized.organization ??
            memberships[0]?.organization ??
            (yield* createOrganizationWithOwner(repository, user.id, "Personal").pipe(
              Effect.catchTag("OrganizationError", Effect.die),
            ));
          yield* repository.auth.session.create({
            userId: user.id,
            tokenHash: sessionTokenHash,
            activeOrganizationId: organization.id,
            expiresAt: DateTime.addDuration(now, config.session.timeToLive),
          });
        }),
      );

      yield* Metric.update(magicLinkVerificationResults, "success");
      yield* Effect.logInfo("magic_link.verified", { method: input.type });
      return {
        sessionToken,
        returnTo: verification.data.returnTo ?? config.returnTo.defaultPath,
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { request, verify } satisfies MagicLinkApplication;
});
