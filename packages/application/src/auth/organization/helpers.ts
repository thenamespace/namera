import { Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import {
  OrganizationError,
  type Email,
  type OrganizationId,
  type OrganizationRoleId,
  type UserId,
} from "@namera-ai/protocol";

export const createUserOrganizationMember = Effect.fn("createUserOrganizationMember")(function* (
  repository: RepositoryService,
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

  return yield* repository.auth.member.insert({
    actorId: actor.id,
    ...input,
  });
});

export const createOrganizationWithOwner = Effect.fn("createOrganizationWithOwner")(function* (
  repository: RepositoryService,
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

  yield* createUserOrganizationMember(repository, {
    userId,
    organizationId: organization.id,
    organizationRoleId: ownerRole.id,
  });

  return organization;
});

export const createUserWithPersonalOrganization = Effect.fn("createUserWithPersonalOrganization")(
  function* (repository: RepositoryService, email: Email) {
    const user = yield* repository.auth.user.create({
      email,
      metadata: { version: 1 },
    });
    const organization = yield* createOrganizationWithOwner(repository, user.id, "Personal");

    return { user, organization };
  },
);
