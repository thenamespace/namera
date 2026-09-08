import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  createMember,
  findOrganizationRole,
  makeTestApiClient,
  organizationMetadata,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("workspace authority changes", (it) => {
  it.effect("applies role downgrade and removal to an existing browser session immediately", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("access-change-owner@example.com"));
      const admin = yield* createMember(
        client,
        testEmail("access-change-admin@example.com"),
        "admin",
      );
      const memberRole = yield* findOrganizationRole(admin.owner.organization.id, "member");
      const existingSessionId = (yield* client.session.currentUser()).session.id;
      expect((yield* client.session.currentUser()).role.key).toBe("admin");
      yield* client.wallet.createPasskeyRegistrationOptions();
      yield* client.organization.update({
        payload: { metadata: organizationMetadata("Admin update") },
      });

      yield* setAuthToken(admin.ownerToken);
      yield* client.member.updateMemberRole({
        payload: {
          organizationMemberId: admin.actor.member.organizationMember.id,
          organizationRoleId: memberRole.id,
        },
      });
      const repository = yield* Repository;
      const auditAfterDowngrade = yield* repository.audit.organization.findForOrganization(
        admin.owner.organization.id,
      );

      yield* setAuthToken(admin.memberToken);
      expect(yield* client.session.currentUser()).toMatchObject({
        session: { id: existingSessionId },
        role: { key: "member" },
      });
      expect(yield* client.member.listOrgMembers()).toHaveLength(2);
      const mutations: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
        client.wallet.createPasskeyRegistrationOptions(),
        client.organization.update({
          payload: { metadata: organizationMetadata("Forbidden update") },
        }),
        client.invitation.inviteMember({
          payload: {
            email: testEmail("forbidden-invite@example.com"),
            organizationRoleId: memberRole.id,
          },
        }),
        client.member.updateMemberRole({
          payload: {
            organizationMemberId: admin.owner.member.organizationMember.id,
            organizationRoleId: memberRole.id,
          },
        }),
        client.member.removeMember({
          payload: { organizationMemberId: admin.owner.member.organizationMember.id },
        }),
      ];
      for (const mutation of mutations) {
        expect(yield* mutation.pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });
      }
      expect(
        yield* repository.audit.organization.findForOrganization(admin.owner.organization.id),
      ).toEqual(auditAfterDowngrade);
      expect((yield* client.session.currentUser()).organization.metadata.name).toBe("Admin update");

      yield* setAuthToken(admin.ownerToken);
      yield* client.member.removeMember({
        payload: { organizationMemberId: admin.actor.member.organizationMember.id },
      });
      yield* setAuthToken(admin.memberToken);
      const reads: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
        client.session.currentUser(),
        client.wallet.list(),
        client.sessionKey.listForOrganization(),
        client.execution.list({ query: {} }),
        client.member.listOrgMembers(),
        client.billing.get(),
        client.notification.list({ query: {} }),
      ];
      for (const read of reads) {
        expect(yield* read.pipe(Effect.flip)).toMatchObject({ _tag: "Unauthorized" });
      }

      yield* setAuthToken(admin.ownerToken);
      expect((yield* client.session.currentUser()).role.key).toBe("owner");
      expect(yield* client.member.listOrgMembers()).toHaveLength(1);
    }),
  );
});
