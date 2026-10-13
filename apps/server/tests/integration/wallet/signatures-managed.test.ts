import { expect, layer } from "@effect/vitest";
import { Effect, Ref } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Database, Repository } from "@namera-ai/database";
import { makeTestEvmOwnerSignatureService } from "@namera-ai/evm";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const testLayer = makeTestServerLayer(
  { ownerSignatures: makeTestEvmOwnerSignatureService() },
  undefined,
  makeTestConfigLayer({
    ONECLAW_PLATFORM_APP_ID: "test-app",
    ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  }),
  undefined,
  oneClawAccountTestLayer(),
);

layer(testLayer)("managed wallet signatures", (it) => {
  it.effect(
    "prepares without signing, signs once on completion and denies replay after key disable",
    () =>
      Effect.gen(function* () {
        yield* resetTestState();
        yield* TestClock.setTime(Date.now());
        const author = yield* signIn(
          yield* makeTestApiClient,
          testEmail("managed-signature@example.com"),
        );
        const client = yield* handledApi(NameraApi, {
          headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
        });
        const wallet = yield* client.wallet.create({
          payload: {
            namespace: "eip155",
            owner: { type: "namera-managed", provider: "1claw" },
            metadata: { version: 1, name: "Treasury" },
          },
        });
        const control = yield* OneClawTestControl;
        yield* Ref.set(control.calls, []);
        const params = { walletId: wallet.id };
        const prepared = yield* client.walletSignature.prepare({
          params,
          headers: { "idempotency-key": "managed-sign" },
          payload: {
            namespace: "eip155",
            chainId: "eip155:8453",
            type: "message",
            message: "Authorize upload",
          },
        });
        expect(prepared.signing.method).toBe("server");
        expect(yield* Ref.get(control.calls)).toEqual([]);
        const input = {
          params,
          payload: { namespace: "eip155" as const, operationId: prepared.operationId },
        };
        const result = yield* client.walletSignature.complete(input);
        expect(yield* client.walletSignature.complete(input)).toEqual(result);
        expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
        const rows = yield* (yield* Database).query.walletSignatureOperation.findMany();
        expect(rows[0]?.encryptedResult).not.toContain(result.signature);
        yield* (yield* Repository).core.signingKey.setStatus(
          wallet.owner.signingKeyId,
          author.actor.organization.id,
          "disabled",
        );
        expect(yield* client.walletSignature.complete(input).pipe(Effect.flip)).toMatchObject({
          code: "OWNER_UNAVAILABLE",
        });
      }),
  );
});
