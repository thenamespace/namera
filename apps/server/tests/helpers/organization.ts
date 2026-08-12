import { Effect, Option } from "effect";

import { Repository } from "@namera-ai/database";
import type { Email, OrganizationId } from "@namera-ai/protocol";

import { TestAuthToken } from "../layers/index.js";
import type { TestApiClient } from "./api.js";
import { signIn } from "./auth.js";
import { organizationMetadata } from "./fixtures.js";

export const createOrganization = Effect.fn("createOrganization")(function* (
  client: TestApiClient,
  name: string,
) {
  return yield* client.organization.create({
    payload: { metadata: organizationMetadata(name) },
  });
});

export const findOrganizationRole = Effect.fn("findOrganizationRole")(function* (
  organizationId: OrganizationId,
  key: "owner" | "admin" | "member",
) {
  const repository = yield* Repository;
  const roles = yield* repository.auth.role.findOrganizationRolesForOrgId(organizationId);
  const role = roles.find((candidate) => candidate.key === key);
  if (role === undefined) {
    return yield* Effect.die(`Expected ${key} role for organization`);
  }
  return role;
});

export const inviteMember = Effect.fn("inviteMember")(function* (
  client: TestApiClient,
  email: Email,
  organizationId: OrganizationId,
  role: "admin" | "member" = "member",
) {
  const organizationRole = yield* findOrganizationRole(organizationId, role);
  return yield* client.invitation.inviteMember({
    payload: {
      email,
      organizationRoleId: organizationRole.id,
    },
  });
});

export const createMember = Effect.fn("createMember")(function* (
  client: TestApiClient,
  email: Email,
  role: "admin" | "member" = "member",
) {
  const owner = yield* client.session.currentUser();
  const authToken = yield* TestAuthToken;
  const ownerToken = Option.getOrThrowWith(
    yield* authToken.get,
    () => new Error("Expected owner auth token"),
  );
  const invitation = yield* inviteMember(client, email, owner.organization.id, role);
  const member = yield* signIn(client, email);
  yield* client.invitation.acceptInvitation({
    payload: { invitationId: invitation.invitation.id },
  });
  const actor = yield* client.session.currentUser();

  return {
    actor,
    invitation,
    memberToken: member.cookie.value,
    owner,
    ownerToken,
  };
});
