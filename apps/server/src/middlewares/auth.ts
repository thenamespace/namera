import { Effect, Layer, Redacted } from "effect";

import { AuthenticatedUser, Authorization, Unauthorized } from "@namera-ai/api";
import { AdminDatabase } from "@namera-ai/database";

export const AuthMiddleware = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const db = yield* AdminDatabase.AdminDatabase;

    return {
      authToken: (effect, { credential }) =>
        Effect.provideServiceEffect(
          effect,
          AuthenticatedUser,
          Effect.gen(function* () {
            // Get Session with user
            const res = yield* db.query.session
              .findFirst({
                where: {
                  token: { eq: Redacted.value(credential) },
                  revokedAt: { isNull: true },
                  deletedAt: { isNull: true },
                  expiresAt: { gt: new Date() },
                },
                with: {
                  user: true,
                },
              })
              .pipe(Effect.catch(() => Effect.fail(new Unauthorized())));

            if (!res?.user) return yield* Effect.fail(new Unauthorized());

            const { user, ...session } = res;
            const { token: _token, ...sessionWithoutToken } = session;
            yield* Effect.annotateCurrentSpan("userId", user.id);

            if (!session.activeOrganizationId) {
              return {
                user,
                session: sessionWithoutToken,
              };
            }

            const organization = yield* db.query.organization
              .findFirst({
                where: {
                  id: { eq: session.activeOrganizationId },
                  deletedAt: { isNull: true },
                },
                with: {
                  members: {
                    where: {
                      userId: {
                        eq: user.id,
                      },
                    },
                    with: {
                      role: true,
                    },
                  },
                },
              })
              .pipe(Effect.catch(() => Effect.fail(new Unauthorized())));

            if (!organization) return { user, session: sessionWithoutToken };

            const { members, ...restOrg } = organization;
            const member = members[0];

            if (!member) {
              return {
                user,
                session: sessionWithoutToken,
                organization: restOrg,
              };
            }

            const { roleId: _roleId, role, ...m } = member;

            return {
              user,
              session: sessionWithoutToken,
              organization: restOrg,
              member: { ...m, role: role! },
            };
          }).pipe(Effect.withSpan("getCurrentUser")),
        ),
    };
  }),
);
