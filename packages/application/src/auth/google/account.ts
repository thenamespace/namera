import { DateTime, Duration, Effect, Metric } from "effect";

import { Repository, type RepositoryService } from "@namera-ai/database";
import { GoogleAuthError, type SessionId, type UserId } from "@namera-ai/protocol";
import type { Account, GoogleIdentity, User } from "@namera-ai/protocol/model";
import { connectedAccountTransitions } from "@namera-ai/telemetry";

import { Audit } from "#/audit/layer";
import { makeCreateNotification } from "#/notification/create";

export const googleFlowLifetime = Duration.minutes(10);
export const googleRecentAuthentication = Duration.minutes(10);

export const requireRecentSession = Effect.fnUntraced(function* (
  repository: RepositoryService,
  userId: UserId,
  sessionId: SessionId,
) {
  const now = yield* DateTime.now;
  const session = yield* repository.auth.session.findActiveById(sessionId, userId, now);
  if (
    !session ||
    DateTime.toEpochMillis(now) - DateTime.toEpochMillis(session.createdAt) >
      Duration.toMillis(googleRecentAuthentication)
  ) {
    return yield* new GoogleAuthError({ code: "REAUTHENTICATION_REQUIRED" });
  }
  return session;
});

export const makeAccountChanges = Effect.gen(function* () {
  const repository = yield* Repository;
  const audit = yield* Audit;
  const createNotification = yield* makeCreateNotification;

  const notify = Effect.fnUntraced(function* (
    user: User,
    sessionId: SessionId | null,
    account: Account,
    action: "linked" | "unlinked",
  ) {
    const now = yield* DateTime.now;
    const event = yield* audit.user({
      userId: user.id,
      sessionId,
      event: action === "linked" ? "user.account_linked" : "user.account_unlinked",
      data: { version: 1, provider: "google", accountId: account.id },
    });
    yield* createNotification({
      organizationId: null,
      actorId: null,
      type: "auth.account-changed",
      resourceType: "connected-account",
      resourceId: account.id,
      data: { version: 1, provider: "google", action },
      idempotencyKey: `notification:auth.account-changed:${event.id}`,
      correlationId: event.correlationId,
      expiresAt: null,
      recipients: [
        {
          userId: user.id,
          email: {
            type: "connected-account-changed",
            to: user.email,
            variables: {
              provider: "Google",
              action: action === "linked" ? "connected" : "disconnected",
              changedAt: DateTime.formatIso(now),
            },
            expiresAt: DateTime.addDuration(now, Duration.days(1)),
          },
        },
      ],
    });
  });

  const link = Effect.fnUntraced(function* (
    user: User,
    sessionId: SessionId | null,
    identity: GoogleIdentity,
  ) {
    yield* repository.auth.account.lockUser(user.id);
    const existing = yield* repository.auth.account.findGoogle(identity.subject);
    if (existing) {
      if (existing.userId !== user.id)
        return yield* new GoogleAuthError({ code: "GOOGLE_ALREADY_LINKED" });
      return false;
    }
    const account = yield* repository.auth.account.linkGoogle({
      userId: user.id,
      subject: identity.subject,
      email: identity.email,
    });
    if (!account) return yield* new GoogleAuthError({ code: "GOOGLE_ALREADY_LINKED" });
    yield* notify(user, sessionId, account, "linked");
    return true;
  });
  return { link, notify };
});

export const recordAccountTransition = (action: "linked" | "unlinked") =>
  Effect.all(
    [
      Metric.update(
        Metric.withAttributes(connectedAccountTransitions, { provider: "google", action }),
        1,
      ),
      Effect.logInfo("auth.account_changed").pipe(
        Effect.annotateLogs({ provider: "google", action }),
      ),
    ],
    { discard: true },
  );
