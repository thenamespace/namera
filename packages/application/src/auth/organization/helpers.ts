import { Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import {
  GoogleAuthError,
  type Email,
  type OrganizationId,
  type OrganizationRoleId,
  type UserId,
} from "@namera-ai/protocol";

import type { AuditService } from "#/audit/layer";
import { initializeOrganizationBilling } from "#/billing/index";

export const createUserOrganizationMember = Effect.fn("application.createUserOrganizationMember")(
  function* (
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
  },
);

export const createOrganizationWithOwner = Effect.fn("application.createOrganizationWithOwner")(
  function* (repository: RepositoryService, audit: AuditService, userId: UserId, name: string) {
    const availableRoles = yield* repository.auth.role.findSystemRoles();
    const ownerSystemRole = availableRoles.find((role) => role.key === "owner");
    if (!ownerSystemRole) {
      return yield* Effect.die("The owner system role has not been seeded");
    }

    const organization = yield* repository.auth.organization.insert({
      createdById: userId,
      metadata: { version: 1, name },
    });

    yield* initializeOrganizationBilling(repository, organization.id, organization.createdAt);

    const roles = yield* Effect.forEach(availableRoles, (role) =>
      repository.auth.role.insert({
        organizationId: organization.id,
        systemRoleId: role.id,
      }),
    );
    const ownerRole = roles.find((role) => role.systemRoleId === ownerSystemRole.id);
    if (!ownerRole) {
      return yield* Effect.die("The owner organization role was not created");
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
  },
);

export const createUserWithPersonalOrganization = Effect.fn(
  "application.createUserWithPersonalOrganization",
)(function* (repository: RepositoryService, audit: AuditService, email: Email, requireNew = false) {
  const create = requireNew ? repository.auth.user.createIfAbsent : repository.auth.user.create;
  const user = yield* create({
    email,
    metadata: { version: 1 },
  });
  if (!user) return yield* new GoogleAuthError({ code: "GOOGLE_ACCOUNT_EXISTS" });
  yield* audit.user({
    userId: user.id,
    sessionId: null,
    event: "user.created",
    data: { version: 1 },
  });
  const organization = yield* createOrganizationWithOwner(repository, audit, user.id, "Personal");

  return { user, organization };
});
