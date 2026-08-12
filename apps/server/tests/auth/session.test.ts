import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

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

      const remaining = yield* client.session.listSessions();
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.id).toBe(second.session.id);

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
});
