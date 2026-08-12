import { expect, layer } from "@effect/vitest";
import { DateTime, Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  createSession,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("session routes", (it) => {
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
});
