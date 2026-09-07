import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

layer(TestServerLayer)("notification inbox routes", (it) => {
  it.effect("lists the sign-in notification and updates its unread state", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("notification-inbox@example.com"));

      const page = yield* client.notification.list({ query: {} });
      expect(page.items).toHaveLength(1);
      expect(page.items[0]?.notification.type).toBe("auth.new-sign-in");
      expect(yield* client.notification.unreadCount()).toEqual({ count: 1 });

      const notificationId = page.items[0]?.notification.id;
      if (notificationId === undefined) return yield* Effect.die("Expected a notification");
      yield* client.notification.markRead({ payload: { notificationId } });
      expect(yield* client.notification.unreadCount()).toEqual({ count: 0 });

      yield* client.notification.archive({ payload: { notificationId } });
      expect((yield* client.notification.list({ query: {} })).items).toHaveLength(0);
    }),
  );

  it.effect("does not let another user mutate a notification", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const first = yield* signIn(client, testEmail("notification-owner@example.com"));
      const page = yield* client.notification.list({ query: {} });
      const notificationId = page.items[0]?.notification.id;
      if (notificationId === undefined) return yield* Effect.die("Expected a notification");

      yield* signIn(client, testEmail("notification-other@example.com"));
      yield* client.notification.markRead({ payload: { notificationId } });
      yield* client.notification.archive({ payload: { notificationId } });

      yield* setAuthToken(first.cookie.value);
      expect(yield* client.notification.unreadCount()).toEqual({ count: 1 });
      expect((yield* client.notification.list({ query: {} })).items).toHaveLength(1);
    }),
  );

  it.effect("links the sign-in notification to its durable email job", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("notification-email@example.com"));
      const repository = yield* Repository;
      const page = yield* repository.notification.inbox.listForUser({
        userId: signedIn.actor.user.id,
        limit: 10,
        now: yield* DateTime.now,
      });
      const emailJobId = page[0]?.recipient.emailJobId;
      if (emailJobId === null || emailJobId === undefined) {
        return yield* Effect.die("Expected a linked email job");
      }
      const job = yield* repository.jobs.email.findById(emailJobId);
      expect(job?.type).toBe("new-sign-in");
      expect(job?.status).toBe("pending");
    }),
  );

  it.effect("paginates deterministically and marks every inbox item as read", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("notification-page@example.com"));
      const repository = yield* Repository;

      for (let index = 0; index < 31; index += 1) {
        const created = yield* repository.notification.inbox.create({
          organizationId: null,
          actorId: null,
          type: "auth.new-sign-in",
          resourceType: "session",
          resourceId: signedIn.actor.session.id,
          data: { version: 1, ipAddress: null, userAgent: null },
          idempotencyKey: `test:notification-page:${index}`,
          correlationId: `test-notification-page-${index}`,
          expiresAt: null,
        });
        yield* repository.notification.inbox.addRecipient({
          notificationId: created.notification.id,
          userId: signedIn.actor.user.id,
        });
      }

      const first = yield* client.notification.list({ query: {} });
      expect(first.items).toHaveLength(30);
      expect(first.nextCursor).not.toBeNull();
      if (first.nextCursor === null) return yield* Effect.die("Expected a next cursor");
      const second = yield* client.notification.list({ query: { cursor: first.nextCursor } });
      expect(second.items).toHaveLength(2);
      expect(second.nextCursor).toBeNull();

      expect(yield* client.notification.markAllRead()).toEqual({ count: 32 });
      expect(yield* client.notification.unreadCount()).toEqual({ count: 0 });
    }),
  );
});
