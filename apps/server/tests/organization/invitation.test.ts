import { expect, layer } from "@effect/vitest";
import { Effect, Result } from "effect";

import { Repository } from "@namera-ai/database";

import {
  findOrganizationRole,
  inviteMember,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("invitation routes", (it) => {
  it.effect("creates and lists an invitation for the organization and recipient", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("invite-owner@example.com"));
      const recipientEmail = testEmail("invite-recipient@example.com");
      const invitation = yield* inviteMember(client, recipientEmail, owner.actor.organization.id);

      const organizationInvitations = yield* client.invitation.listInvitations();
      expect(organizationInvitations).toHaveLength(1);
      expect(organizationInvitations[0]?.invitation.id).toBe(invitation.invitation.id);

      const recipient = yield* signIn(client, recipientEmail);
      const userInvitations = yield* client.invitation.listUserInvitations();
      const found = yield* client.invitation.getInvitation({
        query: { invitationId: invitation.invitation.id },
      });

      expect(userInvitations).toHaveLength(1);
      expect(found.invitation.email).toBe(recipient.actor.user.email);
      expect(found.organization.id).toBe(owner.actor.organization.id);
      expect(found.organizationRole.key).toBe("member");
    }),
  );

  it.effect("returns the existing pending invitation for duplicate requests", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("duplicate-owner@example.com"));
      const email = testEmail("duplicate-recipient@example.com");

      const first = yield* inviteMember(client, email, owner.actor.organization.id);
      const second = yield* inviteMember(client, email, owner.actor.organization.id);

      expect(second.invitation.id).toBe(first.invitation.id);
      expect(yield* client.invitation.listInvitations()).toHaveLength(1);
    }),
  );

  it.effect("converges concurrent invitation requests on one delivery", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("concurrent-invite-owner@example.com"));
      const email = testEmail("concurrent-invite-recipient@example.com");
      const role = yield* findOrganizationRole(owner.actor.organization.id, "member");

      const invitations = yield* Effect.all(
        [
          client.invitation.inviteMember({
            payload: { email, organizationRoleId: role.id },
          }),
          client.invitation.inviteMember({
            payload: { email, organizationRoleId: role.id },
          }),
        ],
        { concurrency: "unbounded" },
      );
      expect(new Set(invitations.map((item) => item.invitation.id)).size).toBe(1);

      const repository = yield* Repository;
      const events = (yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      )).filter((event) => event.event === "invitation.created");
      expect(events).toHaveLength(1);
      expect(
        yield* repository.jobs.email.findByIdempotencyKey(
          `organization-invitation:${invitations[0]?.invitation.id}`,
        ),
      ).toBeDefined();
    }),
  );

  it.effect("accepts an invitation, creates membership, and switches the active organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("accept-owner@example.com"));
      const recipientEmail = testEmail("accept-recipient@example.com");
      const invitation = yield* inviteMember(
        client,
        recipientEmail,
        owner.actor.organization.id,
        "admin",
      );
      yield* signIn(client, recipientEmail);

      yield* client.invitation.acceptInvitation({
        payload: { invitationId: invitation.invitation.id },
      });
      const actor = yield* client.session.currentUser();

      expect(actor.organization.id).toBe(owner.actor.organization.id);
      expect(actor.role.key).toBe("admin");
      expect(yield* client.invitation.listUserInvitations()).toHaveLength(0);
      const notifications = yield* client.notification.list({ query: {} });
      expect(
        notifications.items.some(
          (item) => item.notification.resourceId === invitation.invitation.id,
        ),
      ).toBe(false);

      const repeated = yield* client.invitation
        .acceptInvitation({ payload: { invitationId: invitation.invitation.id } })
        .pipe(Effect.flip);
      expect(repeated).toMatchObject({
        _tag: "InvitationError",
        code: "ALREADY_A_MEMBER",
      });
    }),
  );

  it.effect("rejects invitations only for the intended recipient", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("recipient-owner@example.com"));
      const recipientEmail = testEmail("intended@example.com");
      const invitation = yield* inviteMember(client, recipientEmail, owner.actor.organization.id);
      yield* signIn(client, testEmail("wrong-recipient@example.com"));

      const getError = yield* client.invitation
        .getInvitation({ query: { invitationId: invitation.invitation.id } })
        .pipe(Effect.flip);
      const acceptError = yield* client.invitation
        .acceptInvitation({ payload: { invitationId: invitation.invitation.id } })
        .pipe(Effect.flip);

      expect(getError).toMatchObject({
        _tag: "InvitationError",
        code: "INVITATION_RECIPIENT_MISMATCH",
      });
      expect(acceptError).toMatchObject({
        _tag: "InvitationError",
        code: "INVITATION_NOT_FOUND",
      });

      yield* signIn(client, recipientEmail);
      yield* client.invitation.rejectInvitation({
        payload: { invitationId: invitation.invitation.id },
      });
      expect(yield* client.invitation.listUserInvitations()).toHaveLength(0);
    }),
  );

  it.effect("allows the organization to cancel a pending invitation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("cancel-owner@example.com"));
      const invitation = yield* inviteMember(
        client,
        testEmail("cancel-recipient@example.com"),
        owner.actor.organization.id,
      );

      yield* client.invitation.cancelInvitation({
        payload: { invitationId: invitation.invitation.id },
      });
      expect(yield* client.invitation.listInvitations()).toHaveLength(0);
      const repository = yield* Repository;
      expect(
        (yield* repository.jobs.email.findByIdempotencyKey(
          `organization-invitation:${invitation.invitation.id}`,
        ))?.status,
      ).toBe("canceled");

      const repeated = yield* client.invitation
        .cancelInvitation({ payload: { invitationId: invitation.invitation.id } })
        .pipe(Effect.flip);
      expect(repeated).toMatchObject({
        _tag: "InvitationError",
        code: "INVITATION_NOT_FOUND",
      });
    }),
  );

  it.effect("reserves member capacity for pending invitations", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("capacity-owner@example.com"));

      const invitations = yield* Effect.forEach([1, 2, 3, 4], (index) =>
        inviteMember(
          client,
          testEmail(`capacity-${index}@example.com`),
          owner.actor.organization.id,
        ),
      );
      const billing = yield* client.billing.get();
      expect(billing.usage).toMatchObject({ members: 1, pendingInvitations: 4 });

      const error = yield* inviteMember(
        client,
        testEmail("capacity-full@example.com"),
        owner.actor.organization.id,
      ).pipe(Effect.flip);
      expect(error).toMatchObject({
        _tag: "BillingError",
        code: "LIMIT_EXCEEDED",
        limit: "members",
      });

      const firstInvitation = invitations[0];
      if (!firstInvitation) return yield* Effect.die("Expected a pending invitation");
      yield* client.invitation.cancelInvitation({
        payload: { invitationId: firstInvitation.invitation.id },
      });
      yield* inviteMember(
        client,
        testEmail("capacity-released@example.com"),
        owner.actor.organization.id,
      );
      expect((yield* client.billing.get()).usage.pendingInvitations).toBe(4);
    }),
  );

  it.effect("serializes concurrent invitations at the member limit", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("capacity-race-owner@example.com"));
      yield* Effect.forEach([1, 2, 3], (index) =>
        inviteMember(
          client,
          testEmail(`capacity-race-${index}@example.com`),
          owner.actor.organization.id,
        ),
      );

      const results = yield* Effect.all(
        [
          inviteMember(
            client,
            testEmail("capacity-race-a@example.com"),
            owner.actor.organization.id,
          ).pipe(Effect.result),
          inviteMember(
            client,
            testEmail("capacity-race-b@example.com"),
            owner.actor.organization.id,
          ).pipe(Effect.result),
        ],
        { concurrency: "unbounded" },
      );

      expect(results.filter(Result.isSuccess)).toHaveLength(1);
      expect(results.filter(Result.isFailure)).toHaveLength(1);
      expect((yield* client.billing.get()).usage.pendingInvitations).toBe(4);
    }),
  );
});
