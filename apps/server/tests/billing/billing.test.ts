import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { Repository } from "@namera-ai/database";

import {
  createMember,
  createOrganization,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../helpers/index.js";
import { TestServerLayer } from "../layers/index.js";

layer(TestServerLayer)("billing routes", (it) => {
  it.effect("initializes free billing for every organization", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const signedIn = yield* signIn(client, testEmail("billing-owner@example.com"));

      const personalBilling = yield* client.billing.get();
      expect(personalBilling).toMatchObject({
        organizationId: signedIn.actor.organization.id,
        plan: "free",
        planVersion: 1,
        status: "active",
        limits: {
          maxMembers: 5,
          maxSoftwareWallets: 5,
          maxHsmWallets: 0,
          includedExecutions: 100,
          includedSignatures: 10_000,
        },
        usage: {
          members: 1,
          pendingInvitations: 0,
          softwareWallets: 0,
          hsmWallets: 0,
          executions: 0,
          signatures: 0,
        },
      });

      const organization = yield* createOrganization(client, "Billing workspace");
      const organizationBilling = yield* client.billing.get();
      expect(organizationBilling.organizationId).toBe(organization.id);
      expect(organizationBilling.plan).toBe("free");

      const repository = yield* Repository;
      expect(yield* repository.billing.account.findByOrganizationId(organization.id)).toBeDefined();
      expect(yield* repository.billing.subscription.findCurrent(organization.id)).toMatchObject({
        plan: "free",
        planVersion: 1,
      });
    }),
  );

  it.effect("requires billing read permission", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      yield* signIn(client, testEmail("billing-permission-owner@example.com"));
      const admin = yield* createMember(
        client,
        testEmail("billing-permission-admin@example.com"),
        "admin",
      );
      yield* setAuthToken(admin.ownerToken);
      const member = yield* createMember(
        client,
        testEmail("billing-permission-member@example.com"),
      );

      yield* setAuthToken(admin.memberToken);
      expect((yield* client.billing.get()).organizationId).toBe(admin.owner.organization.id);

      yield* setAuthToken(member.memberToken);
      const error = yield* client.billing.get().pipe(Effect.flip);
      expect(error).toMatchObject({ _tag: "Forbidden" });
    }),
  );
});
