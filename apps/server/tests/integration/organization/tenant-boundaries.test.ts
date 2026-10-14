import { expect, layer } from "@effect/vitest";
import { Effect, Exit } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  createMember,
  findOrganizationRole,
  inviteMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("organization tenant boundaries", (it) => {
  it.effect("rejects real foreign organization, membership, role and invitation IDs", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const first = yield* signIn(client, testEmail("boundary-first@example.com"));
      const second = yield* signIn(client, testEmail("boundary-second@example.com"));
      const member = yield* createMember(client, testEmail("boundary-member@example.com"));
      yield* setAuthToken(second.cookie.value);
      const invitation = yield* inviteMember(
        client,
        testEmail("boundary-invite@example.com"),
        second.actor.organization.id,
      );
      yield* setAuthToken(first.cookie.value);
      const ownMember = yield* createMember(client, testEmail("boundary-own-member@example.com"));
      yield* setAuthToken(first.cookie.value);
      const ownRole = yield* findOrganizationRole(first.actor.organization.id, "member");
      const foreignRole = yield* findOrganizationRole(second.actor.organization.id, "member");
      const denied: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
        client.organization.getOrganization({
          query: { organizationId: second.actor.organization.id },
        }),
        client.organization.setActive({
          payload: { organizationId: second.actor.organization.id },
        }),
        client.member.removeMember({
          payload: { organizationMemberId: member.actor.member.organizationMember.id },
        }),
        client.member.updateMemberRole({
          payload: {
            organizationMemberId: member.actor.member.organizationMember.id,
            organizationRoleId: ownRole.id,
          },
        }),
        client.member.updateMemberRole({
          payload: {
            organizationMemberId: ownMember.actor.member.organizationMember.id,
            organizationRoleId: foreignRole.id,
          },
        }),
        client.invitation.cancelInvitation({ payload: { invitationId: invitation.invitation.id } }),
        client.invitation.acceptInvitation({ payload: { invitationId: invitation.invitation.id } }),
      ];
      const codes = [
        "ORGANIZATION_NOT_FOUND",
        "ORGANIZATION_NOT_FOUND",
        "ORGANIZATION_MEMBER_NOT_FOUND",
        "ORGANIZATION_MEMBER_NOT_FOUND",
        "ORGANIZATION_NOT_FOUND",
        "INVITATION_NOT_FOUND",
        "INVITATION_NOT_FOUND",
      ];
      for (const [index, request] of denied.entries())
        expect(yield* request.pipe(Effect.flip)).toMatchObject({ code: codes[index] });
      expect((yield* client.session.currentUser()).organization.id).toBe(
        first.actor.organization.id,
      );
      const repository = yield* Repository;
      expect(
        yield* repository.auth.member.findActiveById(
          member.actor.member.organizationMember.id,
          second.actor.organization.id,
        ),
      ).toBeDefined();
      expect(
        (yield* repository.auth.invitation.findById(
          invitation.invitation.id,
          second.actor.organization.id,
        ))?.invitation.status,
      ).toBe("pending");
    }),
  );

  it.effect("uses strict permission dominance for custom roles, not role names", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("custom-owner@example.com"));
      const admin = yield* createMember(client, testEmail("custom-admin@example.com"), "admin");
      yield* setAuthToken(admin.ownerToken);
      const target = yield* createMember(client, testEmail("custom-target@example.com"));
      const repository = yield* Repository;
      const equal = yield* repository.auth.role.insert({
        organizationId: admin.owner.organization.id,
        key: "equal-admin",
        metadata: { version: 1, name: "Viewer" },
        permissions: admin.actor.role.permissions,
      });
      const lower = yield* repository.auth.role.insert({
        organizationId: admin.owner.organization.id,
        key: "lower-admin",
        metadata: { version: 1, name: "Owner" },
        permissions: ["member:read"],
      });
      yield* setAuthToken(admin.memberToken);
      expect(
        yield* client.member
          .updateMemberRole({
            payload: {
              organizationMemberId: target.actor.member.organizationMember.id,
              organizationRoleId: equal.id,
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "INSUFFICIENT_PERMISSIONS" });
      expect(
        (yield* client.member.updateMemberRole({
          payload: {
            organizationMemberId: target.actor.member.organizationMember.id,
            organizationRoleId: lower.id,
          },
        })).organizationRole.id,
      ).toBe(lower.id);
    }),
  );

  for (const action of ["accept", "cancel"] as const) {
    it.effect(`serializes invitation acceptance against ${action}`, () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const owner = yield* signIn(client, testEmail(`race-owner-${action}@example.com`));
        const email = testEmail(`race-invitee-${action}@example.com`);
        const invitation = yield* inviteMember(client, email, owner.actor.organization.id);
        const recipient = yield* signIn(client, email);
        const ownerClient = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${owner.cookie.value}` },
        });
        const recipientClient = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${recipient.cookie.value}` },
        });
        const payload = { invitationId: invitation.invitation.id };
        const results = yield* Effect.all(
          [
            Effect.exit(recipientClient.invitation.acceptInvitation({ payload })),
            Effect.exit(
              action === "cancel"
                ? ownerClient.invitation.cancelInvitation({ payload })
                : recipientClient.invitation.acceptInvitation({ payload }),
            ),
          ],
          { concurrency: "unbounded" },
        );
        expect(results.filter(Exit.isSuccess)).toHaveLength(1);
        const repository = yield* Repository;
        const stored = yield* repository.auth.invitation.findById(
          payload.invitationId,
          owner.actor.organization.id,
        );
        const accepted = stored?.invitation.status === "accepted";
        expect(["accepted", "canceled"]).toContain(stored?.invitation.status);
        const members = yield* repository.auth.member.findOrganizationMembersForOrg(
          owner.actor.organization.id,
        );
        expect(members.filter(({ user }) => user.id === recipient.actor.user.id)).toHaveLength(
          accepted ? 1 : 0,
        );
        const events = yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        );
        expect(
          events.filter(
            (event) =>
              event.event === "invitation.accepted" || event.event === "invitation.canceled",
          ),
        ).toHaveLength(1);
      }),
    );
  }
});
