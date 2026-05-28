import type { SessionId, UserId } from "@namera-ai/schema";

import { DateTime, Effect } from "effect";

import * as AuthRepo from "@namera-ai/domain/auth";
import {
  CreateOrganizationRequest,
  OrganizationError,
} from "@namera-ai/schema/dto";

export type CreateOrgParams = {
  userId: UserId;
  sessionId: SessionId;
  payload: CreateOrganizationRequest;
};

export const createOrganization = Effect.fn("createOrganization")(function* ({
  userId,
  sessionId,
  payload,
}: CreateOrgParams) {
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
  const systemRoles = yield* auth.role.createSystemRoles(newOrg.id);
  const ownerRole = systemRoles.find((r) => r.key === "owner")!;

  // Create owner member
  yield* auth.member.create({
    organizationId: newOrg.id,
    userId: userId,
    roleId: ownerRole.id,
    joinedAt: yield* DateTime.now,
  });

  // Set current user's active organization
  yield* auth.session.setActiveOrganization(sessionId, userId, newOrg.id);

  return newOrg;
});
