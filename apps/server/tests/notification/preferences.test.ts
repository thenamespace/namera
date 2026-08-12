import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("notification preference routes", (it) => {
  it.effect("updates, lists, audits, and resets a global preference", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("notification-preference@example.com"));

      const updated = yield* client.notification.updatePreference({
        payload: {
          organizationId: null,
          category: "security",
          channel: "email",
          enabled: false,
        },
      });
      expect(updated.enabled).toBe(false);
      yield* client.notification.updatePreference({
        payload: {
          organizationId: null,
          category: "security",
          channel: "email",
          enabled: false,
        },
      });
      expect(yield* client.notification.listPreferences()).toHaveLength(1);

      const repository = yield* Repository;
      const events = yield* repository.audit.user.findForUser(signedIn.actor.user.id);
      expect(events.some((event) => event.event === "notification.preference_updated")).toBe(true);

      yield* client.notification.resetPreference({
        payload: {
          organizationId: null,
          category: "security",
          channel: "email",
        },
      });
      yield* client.notification.resetPreference({
        payload: {
          organizationId: null,
          category: "security",
          channel: "email",
        },
      });
      expect(yield* client.notification.listPreferences()).toHaveLength(0);
      const preferenceEvents = (yield* repository.audit.user.findForUser(
        signedIn.actor.user.id,
      )).filter((event) => event.event === "notification.preference_updated");
      expect(preferenceEvents).toHaveLength(2);
    }),
  );

  it.effect("rejects preferences for an organization outside the active session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const first = yield* signIn(client, testEmail("notification-scope-first@example.com"));
      const second = yield* signIn(client, testEmail("notification-scope-second@example.com"));
      yield* setAuthToken(first.cookie.value);

      const error = yield* client.notification
        .updatePreference({
          payload: {
            organizationId: second.actor.organization.id,
            category: "organization",
            channel: "email",
            enabled: false,
          },
        })
        .pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "Forbidden" });
    }),
  );

  it.effect("suppresses configurable sign-in email while keeping the in-app notification", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("notification-suppressed@example.com");
      const first = yield* signIn(client, email);
      yield* client.notification.updatePreference({
        payload: {
          organizationId: null,
          category: "security",
          channel: "email",
          enabled: false,
        },
      });

      yield* signIn(client, email);
      const repository = yield* Repository;
      const rows = yield* repository.notification.inbox.listForUser({
        userId: first.actor.user.id,
        limit: 10,
        now: yield* DateTime.now,
      });
      expect(rows).toHaveLength(2);
      expect(rows[0]?.recipient.emailJobId).toBeNull();
    }),
  );
});
