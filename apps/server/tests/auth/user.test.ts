import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
  userMetadata,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("user routes", (it) => {
  it.effect("updates the authenticated user's required metadata", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("profile@example.com"));

      const metadata = userMetadata("Ada");
      const updated = yield* client.user.update({ payload: { metadata } });
      yield* client.user.update({ payload: { metadata } });
      const actor = yield* client.session.currentUser();

      expect(updated.metadata).toEqual(metadata);
      expect(actor.user.metadata).toEqual(metadata);
      const repository = yield* Repository;
      const events = (yield* repository.audit.user.findForUser(actor.user.id)).filter(
        (event) => event.event === "user.updated",
      );
      expect(events).toHaveLength(1);
      expect(events[0]?.data).toEqual({ version: 1, changedFields: ["name"] });
    }),
  );
});
