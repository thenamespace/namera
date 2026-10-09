import { expect, layer } from "@effect/vitest";
import { DateTime, Duration, Effect } from "effect";
import { TestClock } from "effect/testing";

import { Repository } from "@namera-ai/database";

import {
  createSession,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../../fixtures/index.js";
import { TestServerLayer } from "../../../fixtures/layers/index.js";

layer(TestServerLayer)("session routes", (it) => {
  it.effect("expires browser sessions and their cookies after seven days", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("session-expiry@example.com"));
      expect(signedIn.cookie.options?.maxAge).toEqual(Duration.seconds(7 * 86400));
      expect(
        DateTime.toEpochMillis(signedIn.actor.session.expiresAt) -
          DateTime.toEpochMillis(yield* DateTime.now),
      ).toBe(7 * 86400000);
      yield* TestClock.adjust("6 days");
      expect((yield* client.session.currentUser()).user.id).toBe(signedIn.actor.user.id);
      yield* TestClock.adjust("1 day");
      expect(yield* client.session.currentUser().pipe(Effect.flip)).toMatchObject({
        _tag: "Unauthorized",
      });
    }),
  );
  it.effect("rejects requests without an auth token", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const error = yield* client.session.currentUser().pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "Unauthorized" });
    }),
  );

  it.effect("returns the authenticated actor and active sessions", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("sessions@example.com"));

      const actor = yield* client.session.currentUser();
      const sessions = yield* client.session.listSessions();

      expect(actor.user.id).toBe(signedIn.actor.user.id);
      expect(actor.organization.metadata.name).toBe("Personal");
      expect(sessions).toHaveLength(1);
      expect(sessions[0]?.id).toBe(actor.session.id);
      expect(sessions[0]?.createdAt).toBeDefined();
    }),
  );

  it.effect("prevents authenticated responses from being cached", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("no-store@example.com"));

      const [, response] = yield* client.session.currentUser({
        responseMode: "decoded-and-response",
      });
      expect(response.headers["cache-control"]).toBe("no-store");
    }),
  );

  it.effect("revokes every session except the current session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("revoke@example.com"));
      const second = yield* createSession(signedIn.actor);
      yield* setAuthToken(second.token);

      expect(yield* client.session.listSessions()).toHaveLength(2);
      expect(yield* client.session.revokeOtherSessions()).toBe(1);
      expect(yield* client.session.revokeOtherSessions()).toBe(0);

      const remaining = yield* client.session.listSessions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(second.session.id);
      const repository = yield* Repository;
      const events = (yield* repository.audit.user.findForUser(signedIn.actor.user.id)).filter(
        (event) => event.event === "session.others_revoked",
      );
      expect(events).toHaveLength(1);

      yield* setAuthToken(signedIn.cookie.value);
      const revoked = yield* client.session.currentUser().pipe(Effect.flip);
      expect(revoked).toMatchObject({ _tag: "Unauthorized" });
    }),
  );

  it.effect("logs out, clears the cookie, and rejects the revoked session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("logout@example.com"));

      const [, response] = yield* client.session.logout({
        responseMode: "decoded-and-response",
      });
      const cleared = response.cookies.cookies["auth-token"];
      expect(cleared?.value).toBe("");
      expect(cleared?.options).toMatchObject({ httpOnly: true, path: "/" });

      yield* setAuthToken(signedIn.cookie.value);
      const revoked = yield* client.session.currentUser().pipe(Effect.flip);
      expect(revoked).toMatchObject({ _tag: "Unauthorized" });
    }),
  );

  it.effect("clears a stale cookie after the session is revoked elsewhere", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("stale-cookie@example.com"));
      const repository = yield* Repository;
      yield* repository.auth.session.revoke(
        signedIn.actor.session.id,
        signedIn.actor.user.id,
        yield* DateTime.now,
      );

      const response = yield* client.session.currentUser({ responseMode: "response-only" });
      expect(response.status).toBe(401);
      expect(response.cookies.cookies["auth-token"]?.value).toBe("");
    }),
  );

  it.effect("revokes one selected session and records the acting session", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("selected-session@example.com"));
      const second = yield* createSession(signedIn.actor);

      yield* client.session.revokeSession({ params: { sessionId: second.session.id } });
      expect((yield* client.session.listSessions()).map(({ id }) => id)).toEqual([
        signedIn.actor.session.id,
      ]);
      yield* client.session.revokeSession({ params: { sessionId: second.session.id } });

      const repository = yield* Repository;
      const events = (yield* repository.audit.user.findForUser(signedIn.actor.user.id)).filter(
        ({ event, data }) => event === "session.revoked" && data.sessionId === second.session.id,
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.sessionId).toBe(signedIn.actor.session.id);

      yield* setAuthToken(second.token);
      expect(yield* client.session.currentUser().pipe(Effect.flip)).toMatchObject({
        _tag: "Unauthorized",
      });
      yield* setAuthToken(signedIn.cookie.value);
      expect((yield* client.session.currentUser()).session.id).toBe(signedIn.actor.session.id);
    }),
  );

  it.effect(
    "cannot revoke another user's session and clears the cookie for the current target",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        const client = yield* makeTestApiClient;
        const first = yield* signIn(client, testEmail("selected-session-first@example.com"));
        const second = yield* signIn(client, testEmail("selected-session-second@example.com"));

        yield* client.session.revokeSession({ params: { sessionId: first.actor.session.id } });
        yield* setAuthToken(first.cookie.value);
        expect((yield* client.session.currentUser()).user.id).toBe(first.actor.user.id);

        yield* setAuthToken(second.cookie.value);
        const [, response] = yield* client.session.revokeSession({
          params: { sessionId: second.actor.session.id },
          responseMode: "decoded-and-response",
        });
        expect(response.cookies.cookies["auth-token"]?.value).toBe("");
        expect(yield* client.session.currentUser().pipe(Effect.flip)).toMatchObject({
          _tag: "Unauthorized",
        });
      }),
  );
});
