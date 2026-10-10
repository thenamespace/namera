import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";
import { EmailJobs } from "@namera-ai/emails";

import {
  inviteMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestEmails, TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("notification delivery", (it) => {
  it.effect("creates invitation delivery and retires it after acceptance", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("notify-invite-owner@example.com"));
      const recipient = yield* signIn(client, testEmail("notify-invite-recipient@example.com"));
      yield* setAuthToken(owner.cookie.value);

      const invitation = yield* inviteMember(
        client,
        recipient.actor.user.email,
        owner.actor.organization.id,
      );
      yield* setAuthToken(recipient.cookie.value);
      const notifications = yield* client.notification.list({ query: {} });
      const received = notifications.items.find(
        (item) => item.notification.type === "organization.invitation.received",
      );
      expect(received?.notification.resourceId).toBe(invitation.invitation.id);

      const repository = yield* Repository;
      const rows = yield* repository.notification.inbox.listForUser({
        userId: recipient.actor.user.id,
        limit: 10,
        now: yield* DateTime.now,
      });
      const emailJobId = rows.find(
        (item) => item.notification.type === "organization.invitation.received",
      )?.recipient.emailJobId;
      if (emailJobId === null || emailJobId === undefined) {
        return yield* Effect.die("Expected an invitation email job");
      }
      expect((yield* repository.jobs.email.findById(emailJobId))?.type).toBe(
        "organization-invitation",
      );

      yield* client.invitation.acceptInvitation({
        payload: { invitationId: invitation.invitation.id },
      });
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          (item) => item.notification.resourceId === invitation.invitation.id,
        ),
      ).toBe(false);
      expect((yield* repository.jobs.email.findById(emailJobId))?.status).toBe("canceled");
    }),
  );

  it.effect("honors a recipient's organization email preference", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("preference-invite-owner@example.com"));
      const recipient = yield* signIn(client, testEmail("preference-invite-recipient@example.com"));
      yield* client.notification.updatePreference({
        payload: {
          organizationId: null,
          category: "organization",
          topic: "invitations",
          channel: "email",
          enabled: false,
        },
      });
      yield* setAuthToken(owner.cookie.value);

      yield* inviteMember(client, recipient.actor.user.email, owner.actor.organization.id);
      const repository = yield* Repository;
      const rows = yield* repository.notification.inbox.listForUser({
        userId: recipient.actor.user.id,
        limit: 10,
        now: yield* DateTime.now,
      });
      const invitation = rows.find(
        (item) => item.notification.type === "organization.invitation.received",
      );
      expect(invitation?.recipient.emailJobId).toBeNull();
    }),
  );

  it.effect("retires invitation delivery after rejection", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("reject-notify-owner@example.com"));
      const recipient = yield* signIn(client, testEmail("reject-notify-recipient@example.com"));
      yield* setAuthToken(owner.cookie.value);
      const invitation = yield* inviteMember(
        client,
        recipient.actor.user.email,
        owner.actor.organization.id,
      );
      yield* setAuthToken(recipient.cookie.value);

      const repository = yield* Repository;
      const before = yield* repository.notification.inbox.listForUser({
        userId: recipient.actor.user.id,
        limit: 10,
        now: yield* DateTime.now,
      });
      const emailJobId = before.find(
        (item) => item.notification.resourceId === invitation.invitation.id,
      )?.recipient.emailJobId;
      if (emailJobId === null || emailJobId === undefined) {
        return yield* Effect.die("Expected an invitation email job");
      }

      yield* client.invitation.rejectInvitation({
        payload: { invitationId: invitation.invitation.id },
      });
      expect(
        (yield* client.notification.list({ query: {} })).items.some(
          (item) => item.notification.resourceId === invitation.invitation.id,
        ),
      ).toBe(false);
      expect((yield* repository.jobs.email.findById(emailJobId))?.status).toBe("canceled");
    }),
  );

  it.effect("enqueues invitation email when the recipient does not have an account", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("unknown-invite-owner@example.com"));
      const invitation = yield* inviteMember(
        client,
        testEmail("unknown-invite-recipient@example.com"),
        owner.actor.organization.id,
      );
      const repository = yield* Repository;
      const job = yield* repository.jobs.email.findByIdempotencyKey(
        `organization-invitation:${invitation.invitation.id}`,
      );
      expect(job?.type).toBe("organization-invitation");
      expect(job?.status).toBe("pending");

      const emailJobs = yield* EmailJobs;
      const emails = yield* TestEmails;
      let delivered = (yield* emails.sent).findLast(
        (message) => message.type === "organization-invitation",
      );
      for (let attempt = 0; delivered === undefined && attempt < 5; attempt += 1) {
        yield* emailJobs.processOnce;
        delivered = (yield* emails.sent).findLast(
          (message) => message.type === "organization-invitation",
        );
      }
      expect(delivered?.variables).toMatchObject({
        organizationName: owner.actor.organization.metadata.name,
        roleName: "Member",
        inviterAvatarSeed: owner.actor.user.id,
      });
    }),
  );
});
