import { Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import {
  OrganizationError,
  type Email,
  type OrganizationId,
  type OrganizationRoleId,
  type UserId,
} from "@namera-ai/protocol";

import type { AuditService } from "#/audit/layer";

export const createUserOrganizationMember = Effect.fn("createUserOrganizationMember")(function* (
  repository: RepositoryService,
  audit: AuditService,
  input: {
    userId: UserId;
    organizationId: OrganizationId;
    organizationRoleId: OrganizationRoleId;
  },
) {
  const actor = yield* repository.auth.actor.insert({
    organizationId: input.organizationId,
    type: "user",
  });

  const member = yield* repository.auth.member.insert({
    actorId: actor.id,
    ...input,
  });

  yield* audit.organization({
    organizationId: input.organizationId,
    actorId: actor.id,
    event: "member.created",
    resourceType: "member",
    resourceId: member.id,
    data: {
      version: 1,
      userId: input.userId,
      organizationRoleId: input.organizationRoleId,
    },
  });

  return member;
});

export const createOrganizationWithOwner = Effect.fn("createOrganizationWithOwner")(function* (
  repository: RepositoryService,
  audit: AuditService,
  userId: UserId,
  name: string,
) {
  const availableRoles = yield* repository.auth.role.findSystemRoles();
  const ownerSystemRole = availableRoles.find((role) => role.key === "owner");
  if (!ownerSystemRole) {
    return yield* new OrganizationError({
      code: "ORGANIZATION_CREATE_FAILED",
      message: "The owner system role has not been seeded",
    });
  }

  const organization = yield* repository.auth.organization.insert({
    createdById: userId,
    metadata: { version: 1, name },
  });

  const roles = yield* Effect.forEach(availableRoles, (role) =>
    repository.auth.role.insert({
      organizationId: organization.id,
      systemRoleId: role.id,
    }),
  );
  const ownerRole = roles.find((role) => role.systemRoleId === ownerSystemRole.id);
  if (!ownerRole) {
    return yield* new OrganizationError({ code: "ORGANIZATION_CREATE_FAILED" });
  }

  const member = yield* createUserOrganizationMember(repository, audit, {
    userId,
    organizationId: organization.id,
    organizationRoleId: ownerRole.id,
  });

  yield* audit.organization({
    organizationId: organization.id,
    actorId: member.actorId,
    event: "organization.created",
    resourceType: "organization",
    resourceId: organization.id,
    data: { version: 1 },
  });

  return organization;
});

export const createUserWithPersonalOrganization = Effect.fn("createUserWithPersonalOrganization")(
  function* (repository: RepositoryService, audit: AuditService, email: Email) {
    const user = yield* repository.auth.user.create({
      email,
      metadata: { version: 1 },
    });
    yield* audit.user({
      userId: user.id,
      sessionId: null,
      event: "user.created",
      data: { version: 1 },
    });
    const organization = yield* createOrganizationWithOwner(repository, audit, user.id, "Personal");

    return { user, organization };
  },
);
