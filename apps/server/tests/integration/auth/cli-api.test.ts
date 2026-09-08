import { expect, layer } from "@effect/vitest";
import { Effect } from "effect";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { ExecutionSubmissionId, Hex, SignatureOperationId } from "@namera-ai/protocol";

import { handledApi } from "../../fixtures/http-api-test.js";
import {
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { createTestPasskeyWallet, localSessionRequest } from "../../fixtures/local-session.js";
import { makeOwnerSessionTestFixture } from "../../fixtures/owner-session.js";

const fixture = makeOwnerSessionTestFixture();

layer(fixture.layer)("CLI API authority", (it) => {
  it.effect("enforces narrowed device-token scopes, live grants and authorization revocation", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      const api = yield* makeTestApiClient;
      const owner = yield* signIn(api, testEmail("cli-scope@example.com"));
      const wallet = yield* createTestPasskeyWallet(api, "CLI scope wallet");
      const pending = yield* api.sessionKey.create({
        payload: yield* localSessionRequest(wallet.id),
      });
      const session = yield* fixture.confirmOperation(api, pending, "install");
      const app = yield* Application;
      const started = yield* app.oauth.device.start({
        clientId: "namera-cli",
        resource: "http://api.test",
        scopes: [
          "wallet:read",
          "session-key:read",
          "execution:read",
          "execution:execute",
          "signature:create",
          "offline_access",
        ],
        deviceName: "Scope test",
        cliVersion: "0.1.0",
        platform: "test",
      });
      const claim = yield* api.oauth.getOAuthDeviceAuthorization({
        query: { userCode: started.userCode },
      });
      yield* api.oauth.approveOAuthDeviceAuthorization({
        payload: {
          deviceAuthorizationId: claim.id,
          organizationId: owner.actor.organization.id,
          sessionKeyIds: [session.id],
        },
      });
      const token = yield* app.oauth.device.exchange({
        clientId: "namera-cli",
        resource: "http://api.test",
        deviceCode: started.deviceCode,
      });
      if (token.refreshToken === undefined) return yield* Effect.die("Expected refresh token");
      const narrowed = yield* app.oauth.token.refresh({
        clientId: "namera-cli",
        resource: "http://api.test",
        refreshToken: token.refreshToken,
        scopes: ["wallet:read"],
      });
      yield* setAuthToken();
      const cli = yield* handledApi(NameraApi, {
        headers: { authorization: `Bearer ${narrowed.accessToken}` },
      });
      const actor = yield* cli.session.currentActor();
      expect(actor).toMatchObject({
        type: "cli",
        data: { authorization: { scopes: ["wallet:read"] } },
      });
      if (actor.type !== "cli") return yield* Effect.die("Expected CLI actor");
      expect((yield* cli.wallet.list()).map((entry) => entry.id)).toEqual([wallet.id]);
      const execution = {
        namespace: "eip155" as const,
        walletId: wallet.id,
        sessionKeyId: session.id,
        chainId: "eip155:11155111" as const,
        calls: [{ to: wallet.address, value: 0n, data: Hex.make("0x") }],
      };
      const denied: ReadonlyArray<Effect.Effect<unknown, unknown>> = [
        cli.session.currentUser(),
        cli.sessionKey.listForOrganization(),
        cli.execution.list({ query: {} }),
        cli.execution.simulate({ payload: execution }),
        cli.execution.prepare({
          headers: { "idempotency-key": "cli-denied-execution" },
          payload: execution,
        }),
        cli.execution.complete({
          payload: {
            namespace: "eip155",
            submissionId: ExecutionSubmissionId.make("01900000-0000-7000-8000-000000000012"),
            signature: Hex.make(`0x${"11".repeat(65)}`),
          },
        }),
        cli.signature.prepare({
          headers: { "idempotency-key": "cli-denied-signature" },
          payload: {
            namespace: "eip155",
            walletId: wallet.id,
            sessionKeyId: session.id,
            chainId: "eip155:11155111",
            type: "message",
            message: "scope test",
          },
        }),
        cli.signature.complete({
          payload: {
            namespace: "eip155",
            operationId: SignatureOperationId.make("01900000-0000-7000-8000-000000000013"),
            signature: Hex.make(`0x${"11".repeat(65)}`),
          },
        }),
      ];
      for (const request of denied)
        expect(yield* request.pipe(Effect.flip)).toMatchObject({ _tag: "Forbidden" });

      yield* setAuthToken(owner.cookie.value);
      yield* api.sessionKey.revoke({ params: { sessionKeyId: session.id } });
      yield* setAuthToken();
      expect(yield* cli.wallet.list()).toEqual([]);
      expect(
        yield* cli.wallet.get({ params: { walletId: wallet.id } }).pipe(Effect.flip),
      ).toMatchObject({
        _tag: "WalletError",
        code: "WALLET_NOT_FOUND",
      });
      yield* setAuthToken(owner.cookie.value);
      yield* api.oauth.revokeCliAuthorization({
        payload: { authorizationId: actor.data.authorization.id },
      });
      yield* setAuthToken();
      expect(yield* cli.wallet.list().pipe(Effect.flip)).toMatchObject({ _tag: "Unauthorized" });
    }),
  );
});
