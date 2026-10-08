import { DateTime, Effect } from "effect";

import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import { GoogleAuthError } from "@namera-ai/protocol";
import type { Email, UserId } from "@namera-ai/protocol";
import type { GoogleIdentity } from "@namera-ai/protocol/model";

import { Audit } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeAccountChanges } from "#/auth/google/account";
import {
  createOrganizationWithOwner,
  createUserWithPersonalOrganization,
} from "#/auth/organization/helpers";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";
import { dashboardEmailLink } from "#/notification/email-link";

// Called inside the caller's transaction, after its identity proof is consumed.
export const makeCompleteSignIn = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const crypto = yield* CryptoService;
  const repository = yield* Repository;
  const audit = yield* Audit;
  const accountChanges = yield* makeAccountChanges;
  const createNotification = yield* makeCreateNotification;

  return Effect.fnUntraced(function* (input: {
    email: Email;
    method: "magic-link" | "google";
    userId?: UserId;
    identity?: GoogleIdentity;
    ipAddress: string | null;
    userAgent: string | null;
  }) {
    const now = yield* DateTime.now;
    const existing = input.userId
      ? yield* repository.auth.user.findById(input.userId)
      : yield* repository.auth.user.findByEmail(input.email);
    if (input.method === "google" && existing && !input.userId)
      return yield* new GoogleAuthError({ code: "GOOGLE_ACCOUNT_EXISTS" });
    if (input.userId && !existing)
      return yield* new GoogleAuthError({ code: "GOOGLE_FLOW_INVALID" });
    const initialized = existing
      ? { user: existing, organization: undefined }
      : yield* createUserWithPersonalOrganization(
          repository,
          audit,
          input.email,
          input.method === "google",
        );
    const user = initialized.user;
    if (!existing && input.identity) {
      yield* repository.auth.user.updateMetadata(user.id, {
        version: 1,
        ...(input.identity.name ? { name: input.identity.name } : {}),
        ...(input.identity.image
          ? { image: { type: "image" as const, value: input.identity.image } }
          : {}),
      });
    }
    const linked = input.identity ? yield* accountChanges.link(user, null, input.identity) : false;
    yield* repository.auth.user.markEmailVerifiedAndLogin(user.id, now);
    const memberships = yield* repository.auth.member.findMembershipsForUser(user.id);
    const organization =
      initialized.organization ??
      memberships[0]?.organization ??
      (yield* createOrganizationWithOwner(repository, audit, user.id, "Personal"));
    const sessionToken = yield* crypto.randomToken(config.session.tokenBytes);
    const session = yield* repository.auth.session.create({
      userId: user.id,
      tokenHash: yield* crypto.hash({ purpose: cryptoPurpose.sessionToken, value: sessionToken }),
      activeOrganizationId: organization.id,
      ...(input.ipAddress === null ? {} : { ipAddress: input.ipAddress }),
      ...(input.userAgent === null ? {} : { userAgent: input.userAgent }),
      expiresAt: DateTime.addDuration(now, config.session.timeToLive),
    });
    const event = yield* audit.user({
      userId: user.id,
      sessionId: session.id,
      event: "user.signed_in",
      data: {
        version: 1,
        method: input.method,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
      },
    });
    yield* createNotification({
      organizationId: null,
      actorId: null,
      type: "auth.new-sign-in",
      resourceType: "session",
      resourceId: session.id,
      data: { version: 1, ipAddress: input.ipAddress, userAgent: input.userAgent },
      idempotencyKey: `notification:auth.new-sign-in:${session.id}`,
      correlationId: event.correlationId,
      expiresAt: null,
      recipients: [
        {
          userId: user.id,
          email: {
            type: "new-sign-in",
            to: user.email,
            variables: {
              signedInAt: DateTime.formatIso(now),
              actionUrl: dashboardEmailLink(config.dashboardPublicOrigin, "/settings/security"),
              ipAddress: input.ipAddress ?? "Unknown",
              userAgent: input.userAgent ?? "Unknown",
            },
            expiresAt: DateTime.addDuration(
              now,
              notificationPolicy["auth.new-sign-in"].emailTimeToLive,
            ),
          },
        },
      ],
    });
    return { sessionToken, user, linked };
  });
});
