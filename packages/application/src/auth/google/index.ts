import { DateTime, Effect, Metric, Schema } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository, TransactionService } from "@namera-ai/database";
import {
  GoogleAuthError,
  type AccountId,
  type SessionId,
  type UserId,
  VerificationId,
} from "@namera-ai/protocol";
import type { StartGoogleSignInRequest } from "@namera-ai/protocol/dto";
import { googleAuthDuration, googleAuthResults, betaInviteTransitions } from "@namera-ai/telemetry";

import { makeCompleteSignIn } from "#/auth/complete-sign-in";
import { AuthConfig } from "#/auth/config";
import { makeRequestMagicLinkApplication } from "#/auth/magic-link/request";

import {
  googleFlowLifetime,
  makeAccountChanges,
  recordAccountTransition,
  requireRecentSession,
} from "./account.js";
import { GoogleIdentityProvider } from "./provider.js";

const trackFailure =
  (stage: string) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.tapError((error) =>
        Metric.update(
          Metric.withAttributes(googleAuthResults, {
            stage,
            result: error instanceof GoogleAuthError ? error.code : "unexpected_failure",
          }),
          1,
        ),
      ),
    );
const trackResult = (stage: string, result: string) =>
  Metric.update(Metric.withAttributes(googleAuthResults, { stage, result }), 1);

export const makeGoogleApplication = Effect.gen(function* () {
  const provider = yield* GoogleIdentityProvider;
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const completeSignIn = yield* makeCompleteSignIn;
  const requestMagicLink = yield* makeRequestMagicLinkApplication;
  const accountChanges = yield* makeAccountChanges;
  const redirectUri = new URL("/auth/google/callback", config.apiPublicOrigin).toString();

  const start = Effect.fn("application.google.start")(
    function* (
      input: typeof StartGoogleSignInRequest.Type,
      link?: { userId: UserId; sessionId: SessionId },
    ) {
      if (!provider.enabled) return yield* new GoogleAuthError({ code: "GOOGLE_NOT_CONFIGURED" });
      if (link) yield* requireRecentSession(repository, link.userId, link.sessionId);
      const now = yield* DateTime.now;
      const [state, nonce, browserToken, verifier] = yield* Effect.all(
        Array.from({ length: 4 }, () => crypto.randomToken(32)),
      );
      if (!state || !nonce || !browserToken || !verifier)
        return yield* Effect.die("Missing generated OAuth credential");
      const candidate = new URL(
        input.returnTo ?? config.returnTo.defaultPath,
        config.dashboardPublicOrigin,
      );
      const returnTo =
        candidate.origin === config.dashboardPublicOrigin.origin &&
        config.returnTo.allowedPrefixes.some(
          (prefix) => candidate.pathname === prefix || candidate.pathname.startsWith(`${prefix}/`),
        )
          ? `${candidate.pathname}${candidate.search}${candidate.hash}`
          : config.returnTo.defaultPath;
      const verification = yield* repository.auth.verification
        .create({
          purpose: "google-auth",
          identifier: (yield* crypto.randomToken(24)).toLowerCase(),
          tokenHash: yield* crypto.hash({ purpose: cryptoPurpose.googleState, value: state }),
          codeHmac: null,
          data: {
            version: 1,
            intent: link ? "link" : "sign-in",
            nonceHash: yield* crypto.hash({ purpose: cryptoPurpose.googleNonce, value: nonce }),
            browserHash: yield* crypto.hash({
              purpose: cryptoPurpose.googleBrowser,
              value: browserToken,
            }),
            encryptedVerifier: yield* crypto.encrypt({
              purpose: cryptoPurpose.googleVerifier,
              value: verifier,
            }),
            returnTo: link ? "/settings/security" : returnTo,
            ...(input.inviteCode ? { inviteCode: input.inviteCode } : {}),
            userId: link?.userId ?? null,
            sessionId: link?.sessionId ?? null,
          },
          expiresAt: DateTime.addDuration(now, googleFlowLifetime),
        })
        .pipe(Effect.orDie);
      if (!verification) return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
      yield* trackResult("start", link ? "link_started" : "sign_in_started");
      return {
        browserToken,
        authorizationUrl: provider.authorizationUrl({
          state: `${verification.id}.${state}`,
          nonce,
          challenge: yield* crypto.sha256(verifier),
          redirectUri,
        }),
      };
    },
    Effect.catchTag("DatabaseError", Effect.die),
    trackFailure("start"),
  );

  const complete = Effect.fn("application.google.complete")(
    function* (
      input: {
        state: string;
        browserToken: string;
        code?: string;
        error?: string;
        authToken?: string;
      },
      context: { ipAddress: string | null; userAgent: string | null },
    ) {
      const credential = yield* Schema.decodeUnknownEffect(
        Schema.Tuple([
          VerificationId,
          Schema.String.check(Schema.isPattern(/^[A-Za-z0-9_-]{43}$/)),
        ]),
      )(input.state.split(".")).pipe(
        Effect.mapError(() => new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" })),
      );
      const flow = yield* repository.auth.verification.findById(credential[0]);
      const now = yield* DateTime.now;
      if (
        !flow ||
        flow.purpose !== "google-auth" ||
        flow.consumedAt ||
        flow.revokedAt ||
        DateTime.toEpochMillis(flow.expiresAt) <= DateTime.toEpochMillis(now) ||
        flow.tokenHash !==
          (yield* crypto.hash({ purpose: cryptoPurpose.googleState, value: credential[1] })) ||
        flow.data.browserHash !==
          (yield* crypto.hash({ purpose: cryptoPurpose.googleBrowser, value: input.browserToken }))
      )
        return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
      // Claim before exchanging the code. Replays never invoke Google twice; a failed
      // exchange requires a new flow rather than replaying a possibly consumed code.
      const claimed = yield* repository.auth.verification.consume({
        verificationId: flow.id,
        consumedAt: now,
        maxAttempts: 1,
      });
      if (!claimed) return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
      if (input.error !== undefined)
        return yield* new GoogleAuthError({
          code: input.error === "access_denied" ? "GOOGLE_CANCELED" : "GOOGLE_IDENTITY_INVALID",
        });
      if (!input.code) return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
      const verifier = yield* crypto
        .decrypt({ purpose: cryptoPurpose.googleVerifier, value: flow.data.encryptedVerifier })
        .pipe(Effect.mapError(() => new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" })));
      const verified = yield* provider.exchange({ code: input.code, verifier, redirectUri });
      if (
        flow.data.nonceHash !==
        (yield* crypto.hash({ purpose: cryptoPurpose.googleNonce, value: verified.nonce }))
      )
        return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
      const identity = verified.identity;

      if (flow.data.intent === "link") {
        const { userId, sessionId } = flow.data;
        if (!userId || !sessionId || !input.authToken)
          return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
        const result = yield* transaction.run(
          Effect.gen(function* () {
            yield* repository.auth.account.lockUser(userId);
            const session = yield* requireRecentSession(repository, userId, sessionId);
            if (
              session.tokenHash !==
              (yield* crypto.hash({
                purpose: cryptoPurpose.sessionToken,
                value: input.authToken ?? "",
              }))
            )
              return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
            const user = yield* repository.auth.user.findById(userId);
            if (!user || !user.emailVerified)
              return yield* new GoogleAuthError({ code: "EMAIL_LOGIN_REQUIRED" });
            return yield* accountChanges.link(user, sessionId, identity);
          }),
        );
        if (result) yield* recordAccountTransition("linked");
        yield* trackResult("callback", "linked");
        return { returnTo: "/settings/security?google=linked" };
      }

      const binding = yield* repository.auth.account.findGoogle(identity.subject);
      if (!binding && (yield* repository.auth.user.findByEmail(identity.email)))
        return yield* new GoogleAuthError({ code: "GOOGLE_ACCOUNT_EXISTS" });
      if (!binding && !identity.emailAuthoritative) {
        yield* requestMagicLink.request(
          {
            email: identity.email,
            returnTo: flow.data.returnTo,
            ...(flow.data.inviteCode ? { inviteCode: flow.data.inviteCode } : {}),
          },
          identity,
        );
        yield* trackResult("callback", "email_confirmation_required");
        return { returnTo: "/auth?google=EMAIL_LOGIN_REQUIRED" };
      }
      const result = yield* transaction.run(
        Effect.gen(function* () {
          // Repeat binding lookup under the owning user lock to serialize unlink/sign-in.
          if (binding) yield* repository.auth.account.lockUser(binding.userId);
          const currentBinding = yield* repository.auth.account.findGoogle(identity.subject);
          if (binding && (!currentBinding || currentBinding.userId !== binding.userId))
            return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
          const invite =
            !currentBinding && flow.data.inviteCode
              ? yield* repository.auth.betaInvite.findByHmac(
                  yield* crypto.hmac({
                    purpose: cryptoPurpose.betaInvite,
                    value: flow.data.inviteCode,
                  }),
                )
              : undefined;
          const lockedInvite = invite
            ? yield* repository.auth.betaInvite.lockActive(invite.id, now)
            : undefined;
          const usableInvite =
            lockedInvite && (lockedInvite.email === null || lockedInvite.email === identity.email)
              ? lockedInvite
              : undefined;
          if (!currentBinding && config.inviteRequired && !usableInvite) {
            const token = yield* crypto.randomToken(32);
            yield* repository.auth.verification.revokePending({
              purpose: "beta-admission",
              identifier: identity.email,
              revokedAt: now,
            });
            const pending = yield* repository.auth.verification.create({
              purpose: "beta-admission",
              identifier: identity.email,
              data: { googleIdentity: identity, returnTo: flow.data.returnTo },
              tokenHash: yield* crypto.hash({
                purpose: cryptoPurpose.betaAdmissionToken,
                value: token,
              }),
              codeHmac: null,
              expiresAt: DateTime.addDuration(now, googleFlowLifetime),
            });
            if (!pending) return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
            return { admissionToken: `${pending.id}.${token}`, returnTo: "/auth/invite" };
          }
          const completed = yield* completeSignIn({
            email: identity.email,
            method: "google",
            ...(currentBinding ? { userId: currentBinding.userId } : {}),
            identity,
            ...context,
          });
          if (usableInvite) {
            const redeemed = yield* repository.auth.betaInvite.redeem(
              usableInvite.id,
              completed.user.id,
              now,
            );
            if (!redeemed) return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
            yield* repository.auth.betaInvite.appendEvent(usableInvite.id, "redeemed");
          }
          yield* repository.auth.account.touchGoogle(identity.subject, identity.email);
          return {
            sessionToken: completed.sessionToken,
            returnTo: flow.data.returnTo,
            linked: completed.linked,
            inviteRedeemed: usableInvite !== undefined,
          };
        }),
      );
      if ("linked" in result && result.linked) yield* recordAccountTransition("linked");
      if ("inviteRedeemed" in result && result.inviteRedeemed)
        yield* Metric.update(
          Metric.withAttributes(betaInviteTransitions, { result: "redeemed" }),
          1,
        );
      yield* trackResult("callback", "sessionToken" in result ? "signed_in" : "invite_required");
      yield* Effect.logInfo("auth.google_completed");
      return result;
    },
    Effect.catchTag("DatabaseError", Effect.die),
    trackFailure("callback"),
    Effect.trackDuration(Metric.withAttributes(googleAuthDuration, { stage: "callback" })),
  );

  const list = Effect.fn("application.connectedAccounts.list")(function* (userId: UserId) {
    return (yield* repository.auth.account.list(userId)).map((account) => ({
      id: account.id,
      provider: "google" as const,
      email: account.providerEmail,
      createdAt: account.createdAt,
    }));
  }, Effect.orDie);
  const unlink = Effect.fn("application.connectedAccounts.unlink")(
    function* (id: AccountId, userId: UserId, sessionId: SessionId) {
      yield* transaction.run(
        Effect.gen(function* () {
          yield* repository.auth.account.lockUser(userId);
          yield* requireRecentSession(repository, userId, sessionId);
          const user = yield* repository.auth.user.findById(userId);
          if (!user?.emailVerified)
            return yield* new GoogleAuthError({ code: "EMAIL_LOGIN_REQUIRED" });
          const removed = yield* repository.auth.account.unlink(id, userId);
          if (!removed) return yield* new GoogleAuthError({ code: "GOOGLE_ACCOUNT_NOT_FOUND" });
          yield* accountChanges.notify(user, sessionId, removed, "unlinked");
        }),
      );
      yield* recordAccountTransition("unlinked");
    },
    Effect.catchTag("DatabaseError", Effect.die),
  );
  return { enabled: provider.enabled, start, complete, list, unlink };
});

export { GoogleIdentityProvider } from "./provider.js";
export { googleIdentityTestLayer } from "./testing.js";
