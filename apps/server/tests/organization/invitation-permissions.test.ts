import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  createMember,
  findOrganizationRole,
  inviteMember,
  makeTestApiClient,
  missingInvitationId,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("invitation permissions", (it) => {
  it.effect("rejects missing invitations and roles from another organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("missing-owner@example.com"));

      const missing = yield* client.invitation
        .getInvitation({ query: { invitationId: missingInvitationId } })
        .pipe(Effect.flip);
      expect(missing).toMatchObject({
        _tag: "InvitationError",
        code: "INVITATION_NOT_FOUND",
      });

      const secondOrganization = yield* client.organization.create({
        payload: { metadata: { version: 1, name: "Second" } },
      });
      const secondRole = yield* findOrganizationRole(secondOrganization.id, "member");
      yield* client.organization.setActive({
        payload: { organizationId: owner.actor.organization.id },
      });

      const wrongRole = yield* client.invitation
        .inviteMember({
          payload: {
            email: testEmail("wrong-role@example.com"),
            organizationRoleId: secondRole.id,
          },
        })
        .pipe(Effect.flip);
      expect(wrongRole).toMatchObject({
        _tag: "OrganizationError",
        code: "ORGANIZATION_NOT_FOUND",
      });
    }),
  );

  it.effect("rejects invitations for existing members and members without permission", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("permissions-owner@example.com"));
      const memberEmail = testEmail("permissions-member@example.com");
      const member = yield* createMember(client, memberEmail);

      yield* setAuthToken(member.ownerToken);
      const existingMember = yield* inviteMember(
        client,
        memberEmail,
        member.owner.organization.id,
      ).pipe(Effect.flip);
      expect(existingMember).toMatchObject({
        _tag: "InvitationError",
        code: "ALREADY_A_MEMBER",
      });

      yield* setAuthToken(member.memberToken);
      const forbidden = yield* client.invitation
        .inviteMember({
          payload: {
            email: testEmail("not-allowed@example.com"),
            organizationRoleId: member.actor.role.id,
          },
        })
        .pipe(Effect.flip);
      expect(forbidden).toMatchObject({ _tag: "Forbidden" });
    }),
  );

  it.effect("prevents an admin from inviting a member into the owner role", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("owner-role-owner@example.com"));
      const admin = yield* createMember(client, testEmail("owner-role-admin@example.com"), "admin");
      const ownerRole = yield* findOrganizationRole(owner.actor.organization.id, "owner");
      yield* setAuthToken(admin.memberToken);

      const error = yield* client.invitation
        .inviteMember({
          payload: {
            email: testEmail("owner-role-target@example.com"),
            organizationRoleId: ownerRole.id,
          },
        })
        .pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "OrganizationError",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }),
  );
});
