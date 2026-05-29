import { Effect, Layer, Redacted, Schema } from "effect";

import { Authorization, CurrentActor } from "@namera-ai/api";
import {
  AdminDatabase,
  Database,
  TransactionOrDatabase,
} from "@namera-ai/database";
import {
  mapToDatabaseError,
  mapToInternalError,
  Unauthorized,
} from "@namera-ai/schema";
import {
  OrganizationMember,
  OrganizationRole,
} from "@namera-ai/schema/database";
import {
  GetOrganizationResponse,
  GetSessionResponse,
  GetUserResponse,
  type CurrentActorResponse,
} from "@namera-ai/schema/dto";

const getCurrentUserActor = Effect.fn("auth.actor.resolve")(
  function* (credential: Redacted.Redacted<string>) {
    const db = yield* TransactionOrDatabase;

    const res = yield* db.query.session.findFirst({
      where: {
        token: { eq: Redacted.value(credential) },
        revokedAt: { isNull: true },
        deletedAt: { isNull: true },
        expiresAt: { gt: new Date() },
      },
      with: {
        user: true,
        organization: true,
      },
    });

    if (!res || !res.user || !res.organization) {
      return yield* Effect.fail(new Unauthorized());
    }

    const { user, organization, ...restSession } = res;

    // Get member
    const memberRes = yield* db.query.member.findFirst({
      where: {
        userId: { eq: user.id },
        deletedAt: { isNull: true },
        removedAt: { isNull: true },
      },
      with: {
        role: {
          with: {
            systemRole: true,
          },
        },
      },
    });

    if (!memberRes || !memberRes.role) {
      return yield* Effect.fail(new Unauthorized());
    }

    const { role: r, ...restMember } = memberRes;
    const { systemRole, ...restRole } = r;

    let role = { ...restRole };
    if (role.systemRoleId && systemRole) {
      role.key = systemRole.key;
      role.metadata = systemRole.metadata;
      role.permissions = systemRole.permissions;
      role.version = systemRole.version;
    }

    const parsedSession =
      Schema.decodeUnknownSync(GetSessionResponse)(restSession);
    const parsedUser = Schema.decodeUnknownSync(GetUserResponse)(user);
    const parsedOrg = Schema.decodeUnknownSync(GetOrganizationResponse)(
      organization,
    );
    const parsedMember =
      Schema.decodeUnknownSync(OrganizationMember)(restMember);
    const parsedRole = Schema.decodeUnknownSync(OrganizationRole)(role);

    yield* Effect.annotateCurrentSpan({
      userId: parsedUser.id,
      "organization.id": parsedOrg.id,
      "organization.role": parsedRole.key,
    });

    return {
      type: "user",
      user: parsedUser,
      session: parsedSession,
      organization: parsedOrg,
      member: parsedMember,
      role: parsedRole,
    } satisfies CurrentActorResponse;
  },
  mapToDatabaseError,
  mapToInternalError,
);

export const AuthMiddleware = Layer.effect(
  Authorization,
  Effect.gen(function* () {
    const db = yield* AdminDatabase.AdminDatabase;

    return {
      authToken: (effect, opts) =>
        Effect.provideServiceEffect(
          effect,
          CurrentActor,
          getCurrentUserActor(opts.credential).pipe(
            Effect.provideService(Database.Database, db),
          ),
        ),
    };
  }),
);
