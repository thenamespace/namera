import { DateTime, Effect, Metric } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  InvalidMagicLinkError,
  GoogleAuthError,
  BetaInviteRequiredError,
  MagicLinkAttemptsExceededError,
  type MagicLinkError,
  type VerificationId,
  type DatabaseError,
} from "@namera-ai/protocol";
import type { VerifyMagicLinkRequest } from "@namera-ai/protocol/dto";
import { betaInviteTransitions, magicLinkVerificationResults } from "@namera-ai/telemetry";

import { makeCompleteSignIn } from "#/auth/complete-sign-in";
import { AuthConfig } from "#/auth/config";
import { recordAccountTransition } from "#/auth/google/account";

export interface VerifyMagicLinkResult {
  readonly sessionToken?: string;
  readonly admissionToken?: string;
  readonly returnTo: string;
}

type RedeemInviteInput = {
  readonly type: "invite";
  readonly id: VerificationId;
  readonly token: string;
  readonly inviteCode: string;
};

export interface VerifyMagicLinkContext {
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
}

export interface VerifyMagicLinkApplication {
  readonly verify: (
    input: VerifyMagicLinkRequest | RedeemInviteInput,
    context: VerifyMagicLinkContext,
  ) => Effect.Effect<VerifyMagicLinkResult, MagicLinkError>;
}

export const makeVerifyMagicLinkApplication = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const completeSignIn = yield* makeCompleteSignIn;

  const verify = Effect.fn("application.magicLink.verify")(
    function* (
      input: VerifyMagicLinkRequest | RedeemInviteInput,
      context: VerifyMagicLinkContext,
    ): Effect.fn.Return<VerifyMagicLinkResult, MagicLinkError | DatabaseError> {
      const now = yield* DateTime.now;
      const verification =
        input.type !== "code"
          ? yield* repository.auth.verification.findById(input.id)
          : yield* repository.auth.verification.findPendingByIdentifier({
              purpose: config.magicLink.purpose,
              identifier: input.email,
              now,
              maxAttempts: config.magicLink.maximumAttempts,
            });

      if (
        !verification ||
        (verification.purpose !== "magic-link-signin" &&
          verification.purpose !== "beta-admission") ||
        verification.purpose !==
          (input.type === "invite" ? "beta-admission" : config.magicLink.purpose) ||
        verification.attempts >= config.magicLink.maximumAttempts ||
        verification.consumedAt !== null ||
        verification.revokedAt !== null ||
        DateTime.toEpochMillis(verification.expiresAt) <= DateTime.toEpochMillis(now)
      ) {
        yield* Metric.update(
          magicLinkVerificationResults,
          verification &&
            DateTime.toEpochMillis(verification.expiresAt) <= DateTime.toEpochMillis(now)
            ? "expired"
            : "invalid",
        );
        return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
      }

      const matches =
        input.type !== "code"
          ? (yield* crypto.hash({
              purpose:
                input.type === "invite"
                  ? cryptoPurpose.betaAdmissionToken
                  : cryptoPurpose.magicLinkToken,
              value: input.token,
            })) === verification.tokenHash
          : yield* crypto.verifyHmac({
              purpose: cryptoPurpose.magicLinkCode,
              value: input.code,
              expected: verification.codeHmac ?? "",
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
            return yield* new MagicLinkAttemptsExceededError({ code: "TOO_MANY_ATTEMPTS" });
          }
        }
        yield* Metric.update(magicLinkVerificationResults, "invalid");
        return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
      }

      const requestedInvite =
        input.type === "invite"
          ? yield* repository.auth.betaInvite.findByHmac(
              yield* crypto.hmac({ purpose: cryptoPurpose.betaInvite, value: input.inviteCode }),
            )
          : undefined;
      if (
        input.type === "invite" &&
        (!requestedInvite ||
          requestedInvite.redeemedAt !== null ||
          requestedInvite.revokedAt !== null ||
          DateTime.toEpochMillis(requestedInvite.expiresAt) <= DateTime.toEpochMillis(now) ||
          (requestedInvite.email !== null && requestedInvite.email !== verification.identifier))
      ) {
        yield* repository.auth.verification.incrementAttempts({
          verificationId: verification.id,
          now,
          maxAttempts: config.magicLink.maximumAttempts,
        });
        return yield* new BetaInviteRequiredError({ code: "INVITE_REQUIRED_OR_UNAVAILABLE" });
      }

      // Consuming the one-time verification and creating the session are one
      // atomic transition. Concurrent clicks can never mint multiple sessions
      // from the same link or code.
      const result = yield* transaction.run(
        Effect.gen(function* () {
          const consumed = yield* repository.auth.verification.consume({
            verificationId: verification.id,
            consumedAt: now,
            maxAttempts: config.magicLink.maximumAttempts,
          });
          if (!consumed) {
            return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
          }

          const existingUser = yield* repository.auth.user.findByEmail(verification.identifier);
          if (
            existingUser &&
            verification.data.googleIdentity &&
            !verification.data.googleIdentity.emailAuthoritative &&
            !verification.data.googleEmailConfirmed
          ) {
            const binding = yield* repository.auth.account.findGoogle(
              verification.data.googleIdentity.subject,
            );
            if (binding?.userId !== existingUser.id)
              return yield* new GoogleAuthError({ code: "GOOGLE_ACCOUNT_EXISTS" });
          }
          const inviteId = requestedInvite?.id ?? verification.data.betaInviteId;
          const candidateInvite =
            !existingUser && inviteId
              ? yield* repository.auth.betaInvite.lockActive(inviteId, now)
              : undefined;
          const invite =
            candidateInvite &&
            (candidateInvite.email === null || candidateInvite.email === verification.identifier)
              ? candidateInvite
              : undefined;
          if (
            !existingUser &&
            config.inviteRequired &&
            (!invite || (invite.email !== null && invite.email !== verification.identifier))
          ) {
            if (input.type === "invite")
              return yield* new BetaInviteRequiredError({ code: "INVITE_REQUIRED_OR_UNAVAILABLE" });
            const pendingToken = yield* crypto.randomToken(config.session.tokenBytes);
            yield* repository.auth.verification.revokePending({
              purpose: "beta-admission",
              identifier: verification.identifier,
              revokedAt: now,
            });
            const pending = yield* repository.auth.verification.create({
              purpose: "beta-admission",
              identifier: verification.identifier,
              data: verification.data,
              tokenHash: yield* crypto.hash({
                purpose: cryptoPurpose.betaAdmissionToken,
                value: pendingToken,
              }),
              codeHmac: null,
              expiresAt: DateTime.addDuration(now, config.magicLink.timeToLive),
            });
            if (!pending)
              return yield* new InvalidMagicLinkError({ code: "INVALID_OR_EXPIRED_LINK" });
            return { admissionToken: `${pending.id}.${pendingToken}`, returnTo: "/auth/invite" };
          }
          const completed = yield* completeSignIn({
            email: verification.identifier,
            method: verification.data.googleIdentity ? "google" : "magic-link",
            ...(existingUser ? { userId: existingUser.id } : {}),
            ...(verification.data.googleIdentity
              ? { identity: verification.data.googleIdentity }
              : {}),
            ...context,
          });
          const user = completed.user;
          if (invite) {
            const redeemed = yield* repository.auth.betaInvite.redeem(
              invite.id,
              user.id,
              yield* DateTime.now,
            );
            if (!redeemed)
              return yield* new BetaInviteRequiredError({ code: "INVITE_REQUIRED_OR_UNAVAILABLE" });
            yield* repository.auth.betaInvite.appendEvent(invite.id, "redeemed");
          }
          return {
            sessionToken: completed.sessionToken,
            linked: completed.linked,
            inviteRedeemed: invite !== undefined,
            returnTo: verification.data.returnTo ?? config.returnTo.defaultPath,
          };
        }),
      );

      if ("linked" in result && result.linked) yield* recordAccountTransition("linked");

      if ("inviteRedeemed" in result && result.inviteRedeemed) {
        yield* Metric.update(
          Metric.withAttributes(betaInviteTransitions, { result: "redeemed" }),
          1,
        );
      }
      yield* Metric.update(magicLinkVerificationResults, "success");
      yield* Effect.logInfo("magic_link.verified").pipe(
        Effect.annotateLogs({ method: input.type }),
      );
      return result.sessionToken !== undefined
        ? { sessionToken: result.sessionToken, returnTo: result.returnTo }
        : result;
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );

  return { verify } satisfies VerifyMagicLinkApplication;
});
