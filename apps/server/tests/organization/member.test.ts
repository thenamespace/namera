import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import {
  createMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("member routes", (it) => {
  it.effect("lists active members with their user and role", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("member-owner@example.com"));
      const member = yield* createMember(client, testEmail("member-list@example.com"));
      yield* setAuthToken(member.ownerToken);

      const members = yield* client.member.listOrgMembers();
      expect(members).toHaveLength(2);
      expect(members.map(({ user }) => user.email)).toEqual(
        expect.arrayContaining(["member-owner@example.com", "member-list@example.com"]),
      );
      expect(members.map(({ organizationRole }) => organizationRole.key)).toEqual(
        expect.arrayContaining(["owner", "member"]),
      );
    }),
  );
});
