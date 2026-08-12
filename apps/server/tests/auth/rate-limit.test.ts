import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  findOrganizationRole,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("route rate limits", (it) => {
  it.effect("limits repeated magic-link requests for the same email", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const email = testEmail("limited@example.com");

      for (let request = 0; request < 5; request += 1) {
        yield* client.magicLink.request({ payload: { email } });
      }
      const error = yield* client.magicLink.request({ payload: { email } }).pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "RateLimitExceeded" });
    }),
  );

  it.effect("limits repeated invitations for the same recipient", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("limited-invite-owner@example.com"));
      const memberRole = yield* findOrganizationRole(owner.actor.organization.id, "member");
      const email = testEmail("limited-invite-recipient@example.com");

      for (let request = 0; request < 5; request += 1) {
        yield* client.invitation.inviteMember({
          payload: { email, organizationRoleId: memberRole.id },
        });
      }
      const error = yield* client.invitation
        .inviteMember({ payload: { email, organizationRoleId: memberRole.id } })
        .pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "RateLimitExceeded" });
    }),
  );
});
