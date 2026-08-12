import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
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
        code: "INVITATION_NOT_FOUND",
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

      const repeated = yield* client.invitation
        .cancelInvitation({ payload: { invitationId: invitation.invitation.id } })
        .pipe(Effect.flip);
      expect(repeated).toMatchObject({
        _tag: "InvitationError",
        code: "INVITATION_NOT_FOUND",
      });
    }),
  );
});
