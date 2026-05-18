import { Effect, Layer, Redacted } from "effect";

import { AuthenticatedUser, Authorization, Unauthorized } from "@namera-ai/api";
import { AdminDatabase } from "@namera-ai/database";
import { Organization, OrganizationMember } from "@namera-ai/schema";

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
            const sessionDetails = yield* db.query.session
              .findFirst({
                where: {
                  token: { eq: Redacted.value(credential) },
                },
                with: {
                  user: true,
                },
              })
              .pipe(Effect.catch(() => Effect.fail(new Unauthorized())));

            // Validate session
            if (
              !sessionDetails?.user ||
              sessionDetails.expiresAt < new Date()
            ) {
              return yield* Effect.fail(new Unauthorized());
            }

            const { user, ...session } = sessionDetails;

            let activeOrganization:
              | (Organization & {
                  member: OrganizationMember;
                })
              | null = null;

            if (session.activeOrganizationId) {
              const organization = yield* db.query.organization
                .findFirst({
                  where: {
                    id: { eq: session.activeOrganizationId },
                  },
                  with: {
                    members: {
                      where: {
                        userId: {
                          eq: user.id,
                        },
                      },
                    },
                  },
                })
                .pipe(Effect.catch(() => Effect.fail(new Unauthorized())));

              if (organization) {
                const { members, ...rest } = organization;
                activeOrganization = { ...rest, member: members[0]! };
              }
            }

            yield* Effect.annotateCurrentSpan("userId", user.id);
            return {
              session,
              user,
              activeOrganization,
            };
          }).pipe(Effect.withSpan("getCurrentUser")),
        ),
    };
  }),
);
