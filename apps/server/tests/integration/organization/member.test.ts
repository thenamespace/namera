import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  createMember,
  findOrganizationRole,
  makeTestApiClient,
  missingOrganizationMemberId,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("member routes", (it) => {
  it.effect("lists active members with their user and role", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-owner@example.com"));
      const member = yield* createMember(client, testEmail("member-list@example.com"));
      yield* setAuthToken(member.ownerToken);

      const members = yield* client.member.listOrgMembers();
      expect(members).toHaveLength(2);
      expect(members.map(({ user }) => user.email)).toEqual(
        expect.arrayContaining(["member-owner@example.com", "member-list@example.com"]),
      );
      expect(members.map(({ organizationRole }) => organizationRole.key)).toEqual(
        expect.arrayContaining(["owner", "member"]),
      );
    }),
  );

  it.effect("lists roles for the active organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-roles-owner@example.com"));

      const roles = yield* client.member.listOrgRoles();

      expect(roles.map(({ key }) => key)).toEqual(
        expect.arrayContaining(["owner", "admin", "member"]),
      );
    }),
  );

  it.effect("lists only roles strictly below the current member", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("assignable-owner@example.com"));
      const admin = yield* createMember(client, testEmail("assignable-admin@example.com"), "admin");

      yield* setAuthToken(admin.ownerToken);
      const ownerRoles = yield* client.member.listAssignableRoles();
      expect(ownerRoles.map(({ key }) => key)).toEqual(expect.arrayContaining(["admin", "member"]));
      expect(ownerRoles.some(({ key }) => key === "owner")).toBe(false);

      yield* setAuthToken(admin.memberToken);
      const adminRoles = yield* client.member.listAssignableRoles();
      expect(adminRoles.map(({ key }) => key)).toEqual(["member"]);
    }),
  );

  it.effect("updates a lower member role once and records the change", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-update-owner@example.com"));
      const member = yield* createMember(client, testEmail("member-update-target@example.com"));
      yield* setAuthToken(member.ownerToken);
      const adminRole = yield* findOrganizationRole(member.owner.organization.id, "admin");

      const updated = yield* client.member.updateMemberRole({
        payload: {
          organizationMemberId: member.actor.member.organizationMember.id,
          organizationRoleId: adminRole.id,
        },
      });
      yield* client.member.updateMemberRole({
        payload: {
          organizationMemberId: member.actor.member.organizationMember.id,
          organizationRoleId: adminRole.id,
        },
      });

      expect(updated.organizationRole.key).toBe("admin");
      const repository = yield* Repository;
      const events = (yield* repository.audit.organization.findForOrganization(
        member.owner.organization.id,
      )).filter((event) => event.event === "member.role_updated");
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toMatchObject({
        previousOrganizationRoleId: member.actor.role.id,
        organizationRoleId: adminRole.id,
      });
    }),
  );

  it.effect("removes a lower member and invalidates their active organization session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-remove-owner@example.com"));
      const member = yield* createMember(client, testEmail("member-remove-target@example.com"));
      yield* setAuthToken(member.ownerToken);

      yield* client.member.removeMember({
        payload: { organizationMemberId: member.actor.member.organizationMember.id },
      });

      expect(yield* client.member.listOrgMembers()).toHaveLength(1);
      const repository = yield* Repository;
      const events = (yield* repository.audit.organization.findForOrganization(
        member.owner.organization.id,
      )).filter((event) => event.event === "member.removed");
      expect(events).toHaveLength(1);

      yield* setAuthToken(member.memberToken);
      const error = yield* client.session.currentUser().pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "Unauthorized" });
    }),
  );

  it.effect("allows admins to manage lower members but not owners or peer admins", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-hierarchy-owner@example.com"));
      const admin = yield* createMember(
        client,
        testEmail("member-hierarchy-admin@example.com"),
        "admin",
      );
      yield* setAuthToken(admin.ownerToken);
      const member = yield* createMember(client, testEmail("member-hierarchy-target@example.com"));
      yield* setAuthToken(admin.ownerToken);
      const removable = yield* createMember(
        client,
        testEmail("member-hierarchy-removable@example.com"),
      );
      yield* setAuthToken(admin.memberToken);
      const adminRole = yield* findOrganizationRole(admin.owner.organization.id, "admin");
      const ownerRole = yield* findOrganizationRole(admin.owner.organization.id, "owner");

      const ownerPromotion = yield* client.member
        .updateMemberRole({
          payload: {
            organizationMemberId: member.actor.member.organizationMember.id,
            organizationRoleId: ownerRole.id,
          },
        })
        .pipe(Effect.flip);
      expect(ownerPromotion).toMatchObject({
        _tag: "OrganizationError",
        code: "INSUFFICIENT_PERMISSIONS",
      });

      yield* client.member.removeMember({
        payload: { organizationMemberId: removable.actor.member.organizationMember.id },
      });

      const peerPromotion = yield* client.member
        .updateMemberRole({
          payload: {
            organizationMemberId: member.actor.member.organizationMember.id,
            organizationRoleId: adminRole.id,
          },
        })
        .pipe(Effect.flip);
      expect(peerPromotion).toMatchObject({
        _tag: "OrganizationError",
        code: "INSUFFICIENT_PERMISSIONS",
      });

      const ownerRemoval = yield* client.member
        .removeMember({
          payload: { organizationMemberId: admin.owner.member.organizationMember.id },
        })
        .pipe(Effect.flip);
      expect(ownerRemoval).toMatchObject({
        _tag: "OrganizationError",
        code: "INSUFFICIENT_PERMISSIONS",
      });
    }),
  );

  it.effect("rejects member management without route permissions", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-permission-owner@example.com"));
      const member = yield* createMember(client, testEmail("member-permission-target@example.com"));
      const memberRole = yield* findOrganizationRole(member.owner.organization.id, "member");
      yield* setAuthToken(member.memberToken);

      const updateError = yield* client.member
        .updateMemberRole({
          payload: {
            organizationMemberId: member.owner.member.organizationMember.id,
            organizationRoleId: memberRole.id,
          },
        })
        .pipe(Effect.flip);
      const removeError = yield* client.member
        .removeMember({
          payload: { organizationMemberId: member.owner.member.organizationMember.id },
        })
        .pipe(Effect.flip);

      expect(updateError).toMatchObject({ _tag: "Forbidden" });
      expect(removeError).toMatchObject({ _tag: "Forbidden" });
    }),
  );

  it.effect("returns not found for a missing active member", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("member-missing-owner@example.com"));
      const memberRole = yield* findOrganizationRole(owner.actor.organization.id, "member");

      const error = yield* client.member
        .updateMemberRole({
          payload: {
            organizationMemberId: missingOrganizationMemberId,
            organizationRoleId: memberRole.id,
          },
        })
        .pipe(Effect.flip);

      expect(error).toMatchObject({
        _tag: "OrganizationMemberError",
        code: "ORGANIZATION_MEMBER_NOT_FOUND",
      });
    }),
  );
});
