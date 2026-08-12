import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  inviteMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("notification delivery", (it) => {
  it.effect("creates an in-app notification and durable email for an existing invitee", () =>
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
    }),
  );
});
