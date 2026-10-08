import { DateTime, Effect } from "effect";

import { Repository, TransactionService } from "@namera-ai/database";
import type { OrganizationId, SessionKeyId } from "@namera-ai/protocol";

import { Audit, type AuditOptions } from "#/audit/layer";
import { AuthConfig } from "#/auth/config";
import { makeCreateNotification } from "#/notification/create";
import { notificationPolicy } from "#/notification/data";
import { dashboardEmailLink } from "#/notification/email-link";

/** Finalize only after no installed permission or broadcastable owner attempt remains. */
export const makeFinishSessionKeyRevocation = Effect.gen(function* () {
  const config = yield* AuthConfig;
  const repository = yield* Repository;
  const transaction = yield* TransactionService;
  const audit = yield* Audit;
  const createNotification = yield* makeCreateNotification;

  return Effect.fn("application.sessionKey.finishRevocation")(function* (
    input: {
      readonly organizationId: OrganizationId;
      readonly sessionKeyId: SessionKeyId;
    },
    options?: AuditOptions,
  ) {
    return yield* transaction.run(
      Effect.gen(function* () {
        const session = yield* repository.core.sessionKey.findById(
          input.sessionKeyId,
          input.organizationId,
        );
        if (session === undefined || session.status !== "revoking") return undefined;
        const wallet = yield* repository.core.wallet.findByIdForUpdate(
          session.walletId,
          input.organizationId,
        );
        if (wallet === undefined) return yield* Effect.die("Revoking session has no wallet");
        const revoked = yield* repository.core.sessionKey.finishRevocation(
          input.sessionKeyId,
          input.organizationId,
        );
        if (revoked === undefined) return undefined;
        if (revoked.revokedByActorId === null || revoked.revokedAt === null)
          return yield* Effect.die("Revoking session has no revocation identity");
        const revokedGrantCount = yield* repository.core.sessionKeyGrant.countRevokedForSession({
          ...input,
          revokedAt: revoked.revokedAt,
        });
        const data = {
          version: 1 as const,
          walletId: revoked.walletId,
          namespace: revoked.namespace,
          revokedGrantCount,
        };
        const event = yield* audit.organization(
          {
            organizationId: input.organizationId,
            actorId: revoked.revokedByActorId,
            event: "session_key.revoked",
            resourceType: "session-key",
            resourceId: revoked.id,
            data,
          },
          options,
        );
        const organization = yield* repository.auth.organization.findById(input.organizationId);
        if (organization === undefined)
          return yield* Effect.die("Session organization disappeared");
        const members = yield* repository.auth.member.findOrganizationMembersForOrg(
          input.organizationId,
        );
        const now = yield* DateTime.now;
        yield* createNotification({
          organizationId: input.organizationId,
          actorId: revoked.revokedByActorId,
          type: "session_key.revoked",
          resourceType: "session-key",
          resourceId: revoked.id,
          data,
          idempotencyKey: `notification:session_key.revoked:${revoked.id}`,
          correlationId: event.correlationId,
          expiresAt: null,
          recipients: members
            .filter(({ organizationRole }) =>
              organizationRole.permissions.includes("session-key:read"),
            )
            .map(({ user }) => ({
              userId: user.id,
              email: {
                type: "session-key-revoked" as const,
                to: user.email,
                expiresAt: DateTime.addDuration(
                  now,
                  notificationPolicy["session_key.revoked"].emailTimeToLive,
                ),
                variables: {
                  sessionKeyName: revoked.metadata.name,
                  actionUrl: dashboardEmailLink(
                    config.dashboardPublicOrigin,
                    `/session-key/${revoked.id}/overview`,
                  ),
                  walletName: wallet.wallet.metadata.name,
                  organizationName: organization.metadata.name,
                  revokedGrantCount,
                },
              },
            })),
        });
        return revoked;
      }),
    );
  });
});
