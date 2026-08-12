import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  createMember,
  createOrganization,
  makeTestApiClient,
  missingOrganizationId,
  organizationMetadata,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("organization routes", (it) => {
  it.effect("creates, lists, reads, and switches organizations", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("organizations@example.com"));
      const personalId = signedIn.actor.organization.id;

      const created = yield* createOrganization(client, "Acme");
      expect(created.metadata).toEqual(organizationMetadata("Acme"));
      expect((yield* client.session.currentUser()).organization.id).toBe(created.id);

      const organizations = yield* client.organization.list();
      expect(organizations).toHaveLength(2);
      expect(organizations.map(({ organization }) => organization.id)).toEqual(
        expect.arrayContaining([personalId, created.id]),
      );
      expect(
        (yield* client.organization.getOrganization({ query: { organizationId: created.id } })).id,
      ).toBe(created.id);

      yield* client.organization.setActive({ payload: { organizationId: personalId } });
      yield* client.organization.setActive({ payload: { organizationId: personalId } });
      expect((yield* client.session.currentUser()).organization.id).toBe(personalId);
      const repository = yield* Repository;
      const events = (yield* repository.audit.user.findForUser(signedIn.actor.user.id)).filter(
        (event) => event.event === "session.active_organization_changed",
      );
      expect(events).toHaveLength(2);
    }),
  );

  it.effect("updates the active organization as its owner", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("org-update@example.com"));
      const metadata = {
        ...organizationMetadata("Personal workspace"),
        description: "Updated organization",
      };

      const updated = yield* client.organization.update({ payload: { metadata } });
      yield* client.organization.update({ payload: { metadata } });
      expect(updated.metadata).toEqual(metadata);
      const actor = yield* client.session.currentUser();
      const repository = yield* Repository;
      const events = (yield* repository.audit.organization.findForOrganization(
        actor.organization.id,
      )).filter((event) => event.event === "organization.updated");
      expect(events).toHaveLength(1);
    }),
  );

  it.effect("does not expose or activate organizations the user does not belong to", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("tenant-owner@example.com"));

      const getError = yield* client.organization
        .getOrganization({ query: { organizationId: missingOrganizationId } })
        .pipe(Effect.flip);
      const setError = yield* client.organization
        .setActive({ payload: { organizationId: missingOrganizationId } })
        .pipe(Effect.flip);

      expect(getError).toMatchObject({
        _tag: "OrganizationError",
        code: "ORGANIZATION_NOT_FOUND",
      });
      expect(setError).toMatchObject({
        _tag: "OrganizationError",
        code: "ORGANIZATION_NOT_FOUND",
      });
      const response = yield* client.organization.getOrganization({
        query: { organizationId: missingOrganizationId },
        responseMode: "response-only",
      });
      expect(response.status).toBe(404);
    }),
  );

  it.effect("forbids a member from updating the active organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("org-owner@example.com"));
      const member = yield* createMember(client, testEmail("org-member@example.com"));
      yield* setAuthToken(member.memberToken);

      const error = yield* client.organization
        .update({ payload: { metadata: organizationMetadata("Forbidden") } })
        .pipe(Effect.flip);

      expect(error).toMatchObject({ _tag: "Forbidden" });
    }),
  );
});
