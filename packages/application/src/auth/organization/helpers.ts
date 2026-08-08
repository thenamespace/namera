import { Effect } from "effect";

import type { RepositoryService } from "@namera-ai/database";
import { OrganizationError } from "@namera-ai/protocol";
import type { OrganizationId, UserId } from "@namera-ai/protocol";

export const createOrganizationWithOwner = Effect.fn("createOrganizationWithOwner")(function* (
  repository: RepositoryService,
  userId: UserId,
  name: string,
) {
  const systemRoles = yield* repository.auth.role.findSystemRoles();
  const ownerSystemRole = systemRoles.find((role) => role.key === "owner");
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

  const roles = yield* Effect.forEach(systemRoles, (role) =>
    repository.auth.role.insert({
      organizationId: organization.id,
      systemRoleId: role.id,
    }),
  );
  const ownerRole = roles.find((role) => role.systemRoleId === ownerSystemRole.id);
  if (!ownerRole) {
    return yield* new OrganizationError({ code: "ORGANIZATION_CREATE_FAILED" });
  }

  yield* repository.auth.member.insert({
    userId,
    organizationId: organization.id,
    organizationRoleId: ownerRole.id,
  });

  return organization;
});

export const requireActiveOrganization = <A>(
  value: A | undefined,
  code: "ORGANIZATION_NOT_FOUND" | "ORGANIZATION_MEMBER_NOT_FOUND" = "ORGANIZATION_NOT_FOUND",
): Effect.Effect<A, OrganizationError> =>
  value === undefined ? Effect.fail(new OrganizationError({ code })) : Effect.succeed(value);

export const organizationNameFromEmail = (email: string): string => {
  const localPart = email.slice(0, email.indexOf("@"));
  return `${localPart}'s organization`;
};

export type OrganizationScope = { readonly organizationId: OrganizationId };
