import { expect, layer } from "@effect/vitest";
import { Effect, Result } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { Repository } from "@namera-ai/database";

import { handledApi } from "../../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();

layer(fixture.layer)("device authorization races", (it) => {
  it.effect("binds one claimant and atomically chooses approval or denial", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const client = yield* makeTestApiClient;
      const first = yield* signIn(client, testEmail("device-first@example.com"));
      const second = yield* signIn(client, testEmail("device-second@example.com"));
      // Pin each request's cookie instead of changing shared client credentials during the race.
      const users = yield* Effect.forEach([first, second], (user) =>
        handledApi(NameraApi, { headers: { cookie: `auth-token=${user.cookie.value}` } }),
      );
      const app = yield* Application;
      const started = yield* app.oauth.device.start({
        clientId: "namera-cli",
        scopes: ["wallet:read"],
        resource: "http://api.test",
        deviceName: "Race fixture",
        cliVersion: "0.1.0",
        platform: "test",
      });
      const claims = yield* Effect.all(
        users.map((user) =>
          user.oauth
            .getOAuthDeviceAuthorization({ query: { userCode: started.userCode } })
            .pipe(Effect.result),
        ),
        { concurrency: "unbounded" },
      );
      expect(claims.filter(Result.isSuccess)).toHaveLength(1);
      expect(claims.filter(Result.isFailure)).toHaveLength(1);
      const winnerIndex = claims.findIndex(Result.isSuccess);
      const winner = users[winnerIndex];
      const owner = [first, second][winnerIndex];
      const claimed = claims[winnerIndex];
      const loser = users[1 - winnerIndex];
      if (
        winner === undefined ||
        owner === undefined ||
        claimed === undefined ||
        !Result.isSuccess(claimed) ||
        loser === undefined
      ) {
        return yield* Effect.die("Expected one claimant");
      }
      const id = claimed.success.id;
      const repository = yield* Repository;
      expect(yield* repository.auth.oauth.deviceAuthorization.findById(id)).toMatchObject({
        claimedByUserId: owner.actor.user.id,
      });
      expect(
        yield* loser.oauth
          .denyOAuthDeviceAuthorization({ payload: { deviceAuthorizationId: id } })
          .pipe(Effect.flip),
      ).toMatchObject({ code: "REQUEST_NOT_FOUND" });
      const wallet = yield* createTestPasskeyWallet(winner, "Device wallet");
      const session = yield* winner.sessionKey.create({
        payload: yield* localSessionRequest(wallet.id),
      });
      yield* fixture.confirmOperation(winner, session, "install");
      const decisions = yield* Effect.all(
        [
          winner.oauth
            .approveOAuthDeviceAuthorization({
              payload: {
                deviceAuthorizationId: id,
                organizationId: owner.actor.organization.id,
                sessionKeyIds: [session.id],
              },
            })
            .pipe(Effect.result),
          winner.oauth
            .denyOAuthDeviceAuthorization({ payload: { deviceAuthorizationId: id } })
            .pipe(Effect.result),
        ],
        { concurrency: "unbounded" },
      );
      expect(decisions.filter(Result.isSuccess)).toHaveLength(1);
      expect(decisions.filter(Result.isFailure)).toHaveLength(1);
      const stored = yield* repository.auth.oauth.deviceAuthorization.findById(id);
      const authorizations = yield* winner.oauth.listCliAuthorizations();
      const audits = yield* repository.audit.organization.findForOrganization(
        owner.actor.organization.id,
      );
      const approved = stored?.status === "approved";
      expect(stored?.status).toBe(approved ? "approved" : "denied");
      expect(authorizations).toHaveLength(approved ? 1 : 0);
      expect(audits.filter(({ event }) => event === "cli_authorization.approved")).toHaveLength(
        approved ? 1 : 0,
      );
      const exchange = yield* app.oauth.device
        .exchange({
          deviceCode: started.deviceCode,
          clientId: "namera-cli",
          resource: "http://api.test",
        })
        .pipe(Effect.result);
      if (approved) {
        expect(Result.isSuccess(exchange)).toBe(true);
        expect(authorizations[0]?.sessionKeys).toMatchObject([{ id: session.id }]);
      } else {
        expect(exchange).toMatchObject({ _tag: "Failure", failure: { code: "ACCESS_DENIED" } });
        expect(stored?.authorizationId).toBeNull();
      }
    }),
  );
});
