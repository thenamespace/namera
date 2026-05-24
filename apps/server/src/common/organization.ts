import { Effect } from "effect";

import * as AuthRepo from "@namera-ai/domain/auth";
import {
  CreateOrganizationRequest,
  mapDatabaseError,
  OrganizationError,
  SessionId,
  UserId,
} from "@namera-ai/schema";

export const createOrganization = (
  userId: UserId,
  sessionId: SessionId,
  payload: CreateOrganizationRequest,
) =>
  Effect.gen(function* () {
    const auth = yield* AuthRepo.AuthRepo;

    const orgsCreatedByUser =
      yield* auth.organization.listOrgsCreatedByUser(userId);

    if (orgsCreatedByUser.length >= 3) {
      return yield* new OrganizationError({
        code: "ORGANIZATION_CREATION_LIMIT_REACHED",
      });
    }

    // Create Organization
    const newOrg = yield* auth.organization.create({
      ...payload,
      plan: "free",
      createdById: userId,
    });

    // Create default system roles.
    const { ownerRole } = yield* auth.role.createSystemRoles(newOrg.id);

    // Create owner member
    yield* auth.member.create({
      organizationId: newOrg.id,
      userId: userId,
      roleId: ownerRole.id,
      joinedAt: new Date(),
    });

    // Set current user's active organization
    yield* auth.session.setActiveOrganization(sessionId, userId, newOrg.id);

    return newOrg;
  }).pipe(mapDatabaseError);
