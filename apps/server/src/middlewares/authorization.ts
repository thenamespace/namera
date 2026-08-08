import { DateTime, Effect, Layer, Redacted } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";

import { Authorization, CurrentActor } from "@namera-ai/api";
import { cryptoPurpose, CryptoService } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";
import type { CurrentActorResponse, GetOrganizationRoleResponse } from "@namera-ai/protocol/dto";

export const AuthorizationLive = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const crypto = yield* CryptoService;
    const repository = yield* Repository;

    return Authorization.of({
      authToken: Effect.fn("Authorization.authToken")(function* (httpEffect, { credential }) {
        const tokenHash = yield* crypto.hash({
          purpose: cryptoPurpose.sessionToken,
          value: Redacted.value(credential),
        });
        const now = yield* DateTime.now;
        const session = yield* repository.auth.session
          .findActiveByTokenHash(tokenHash, now)
          .pipe(Effect.orDie);

        if (session === undefined || session.activeOrganizationId === null) {
          return yield* new HttpApiError.Unauthorized();
        }

        const membership = yield* repository.auth.member
          .findActiveMembership(session.userId, session.activeOrganizationId)
          .pipe(Effect.orDie);

        if (membership === undefined) {
          return yield* new HttpApiError.Unauthorized();
        }

        const user = {
          id: membership.user.id,
          email: membership.user.email,
          emailVerified: membership.user.emailVerified,
          metadata: membership.user.metadata,
          lastLoginAt: membership.user.lastLoginAt,
        };
        const organization = {
          id: membership.organization.id,
          plan: membership.organization.plan,
          metadata: membership.organization.metadata,
        };
        const organizationRole: GetOrganizationRoleResponse =
          membership.organizationRole.type === "system"
            ? {
                id: membership.organizationRole.id,
                key: membership.organizationRole.key,
                metadata: membership.organizationRole.metadata,
                type: membership.organizationRole.type,
                permissions: membership.organizationRole.permissions,
                systemRoleId: membership.organizationRole.systemRoleId,
              }
            : {
                id: membership.organizationRole.id,
                key: membership.organizationRole.key,
                metadata: membership.organizationRole.metadata,
                type: membership.organizationRole.type,
                permissions: membership.organizationRole.permissions,
                systemRoleId: membership.organizationRole.systemRoleId,
              };
        const organizationMember = {
          id: membership.organizationMember.id,
          userId: membership.organizationMember.userId,
          organizationId: membership.organizationMember.organizationId,
          organizationRoleId: membership.organizationMember.organizationRoleId,
          joinedAt: membership.organizationMember.joinedAt,
        };
        const actor: CurrentActorResponse = {
          type: "user",
          data: {
            session: {
              id: session.id,
              userId: session.userId,
              activeOrganizationId: session.activeOrganizationId,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              expiresAt: session.expiresAt,
              revokedAt: session.revokedAt,
            },
            user,
            organization,
            member: {
              organizationMember,
              user,
              organizationRole,
            },
            role: organizationRole,
          },
        };

        return yield* Effect.provideService(httpEffect, CurrentActor, actor);
      }),
    });
  }),
);
