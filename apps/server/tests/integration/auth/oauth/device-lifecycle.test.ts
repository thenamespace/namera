import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";
import { HttpClientRequest } from "effect/http";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import { handledApi } from "../../../fixtures/http-api-test.js";
import {
  makeOAuthProtocolClient,
  makeTestApiClient,
  resetTestState,
  signIn,
  testEmail,
} from "../../../fixtures/index.js";
import { registerPendingLocalSession } from "../../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();
const startInput = {
  clientId: "namera-cli",
  scopes: ["wallet:read"],
  resource: "http://api.test",
  deviceName: "Lifecycle fixture",
  cliVersion: "0.1.0",
  platform: "test",
};

layer(fixture.layer)("OAuth device lifecycle", (it) => {
  it.effect("enforces polling slowdown and expires pending requests without issuing tokens", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("device-expiry@example.com"));
      const app = yield* Application;
      const started = yield* app.oauth.device.start(startInput);
      const claimed = yield* client.oauth.getOAuthDeviceAuthorization({
        query: { userCode: started.userCode },
      });
      const protocol = yield* makeOAuthProtocolClient();
      const request = HttpClientRequest.post("http://api.test/oauth/token").pipe(
        HttpClientRequest.bodyUrlParams({
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
          device_code: started.deviceCode,
          client_id: startInput.clientId,
          resource: startInput.resource,
        }),
      );
      for (const expected of ["authorization_pending", "slow_down"]) {
        const response = yield* protocol.execute(request);
        expect(response.status).toBe(400);
        expect(response.headers["cache-control"]).toBe("no-store");
        expect(yield* response.json).toMatchObject({ error: expected });
      }
      const repository = yield* Repository;
      expect(yield* repository.auth.oauth.deviceAuthorization.findById(claimed.id)).toMatchObject({
        status: "pending",
        pollingIntervalSeconds: started.interval + 5,
        authorizationId: null,
      });
      yield* TestClock.adjust((started.interval + 5) * 1_000);
      expect(yield* (yield* protocol.execute(request)).json).toMatchObject({
        error: "authorization_pending",
      });
      yield* TestClock.adjust(started.expiresIn * 1_000);
      const expired = yield* protocol.execute(request);
      expect(expired.status).toBe(400);
      expect(yield* expired.json).toMatchObject({ error: "expired_token" });
      expect(yield* repository.auth.oauth.deviceAuthorization.findById(claimed.id)).toMatchObject({
        status: "expired",
        authorizationId: null,
      });
      expect(
        yield* repository.auth.oauth.authorization.findForOrganization(owner.actor.organization.id),
      ).toEqual([]);
    }),
  );

  it.effect("rejects another tenant's session key without consuming the device request", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const owner = yield* signIn(client, testEmail("device-own-tenant@example.com"));
      const ownerClient = yield* handledApi(NameraApi, {
        headers: { cookie: `auth-token=${owner.cookie.value}`, origin: "http://dashboard.test" },
      });
      yield* signIn(client, testEmail("device-other-tenant@example.com"));
      const { session: pending } = yield* registerPendingLocalSession(client, ["eip155:1"]);
      const otherSession = yield* fixture.confirmOperation(client, pending, "install");
      const app = yield* Application;
      const started = yield* app.oauth.device.start(startInput);
      const claimed = yield* ownerClient.oauth.getOAuthDeviceAuthorization({
        query: { userCode: started.userCode },
      });
      expect(
        yield* ownerClient.oauth
          .approveOAuthDeviceAuthorization({
            payload: {
              deviceAuthorizationId: claimed.id,
              organizationId: owner.actor.organization.id,
              sessionKeyIds: [otherSession.id],
            },
          })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "SESSION_KEY_NOT_FOUND" });
      const repository = yield* Repository;
      expect(yield* repository.auth.oauth.deviceAuthorization.findById(claimed.id)).toMatchObject({
        status: "pending",
        authorizationId: null,
      });
      expect(
        yield* repository.auth.oauth.authorization.findForOrganization(owner.actor.organization.id),
      ).toEqual([]);
      expect(
        (yield* repository.audit.organization.findForOrganization(
          owner.actor.organization.id,
        )).filter(({ event }) => event === "cli_authorization.approved"),
      ).toEqual([]);
    }),
  );
});
