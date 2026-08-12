import { DateTime, Effect, Layer, Redacted } from "effect";
import { HttpApiError } from "effect/unstable/httpapi";

import { Authorization, CurrentActor } from "@namera-ai/api";
import { CryptoService, cryptoPurpose } from "@namera-ai/crypto";
import { Repository } from "@namera-ai/database";
import type { CurrentActorResponse } from "@namera-ai/protocol/dto";

import {
  toMemberResponse,
  toOrganizationResponse,
  toRoleResponse,
  toSessionResponse,
  toUserResponse,
} from "#/helpers/dto";

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

        const user = toUserResponse(membership.user);
        const organization = toOrganizationResponse(membership.organization);
        const organizationRole = toRoleResponse(membership.organizationRole);
        const actor: CurrentActorResponse = {
          type: "user",
          data: {
            actorId: membership.organizationMember.actorId,
            session: toSessionResponse(session),
            user,
            organization,
            member: toMemberResponse(membership),
            role: organizationRole,
          },
        };

        return yield* Effect.provideService(httpEffect, CurrentActor, actor);
      }),
    });
  }),
);
