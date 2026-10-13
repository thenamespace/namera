import { expect, layer } from "@effect/vitest";
import { Duration, Effect, Option, Ref } from "effect";
import { TestClock } from "effect/testing";

import { NameraApi } from "@namera-ai/api";
import { Application } from "@namera-ai/application";
import { makeTestEvmExecutionService, TestEvmExecution } from "@namera-ai/evm";
import { EthereumAddress } from "@namera-ai/protocol";
import { OneClawTestControl, oneClawAccountTestLayer } from "@namera-ai/wallet-provider-oneclaw";

import { handledApi } from "../../fixtures/http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { makeTestServerLayer } from "../../fixtures/layers/index.js";

const execution = makeTestEvmExecutionService({}, { signWithOwner: true });
const testLayer = makeTestServerLayer(
  {
    identity: {
      status: (_name, address) =>
        Effect.succeed({ primaryName: null, forwardAddress: address, verified: false }),
      call: () =>
        Effect.succeed({
          to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
          value: 0n,
          data: "0x1234",
        }),
    },
    execution: {
      sign: execution.sign,
      getReceipt: (input) =>
        Effect.gen(function* () {
          const receipt = yield* execution.getReceipt(input);
          if (Option.isNone(receipt)) return receipt;
          return Option.some({
            ...receipt.value,
            sender: EthereumAddress.make("0x3333333333333333333333333333333333333333"),
          });
        }),
    },
  },
  undefined,
  makeTestConfigLayer({
    ONECLAW_PLATFORM_APP_ID: "test-app",
    ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
  }),
  undefined,
  oneClawAccountTestLayer(),
);

layer(testLayer)("managed primary approval", (it) => {
  it.effect("does not sign during preparation and signs once after explicit approval", () =>
    Effect.gen(function* () {
      yield* resetTestState();
      yield* TestClock.setTime(Date.now());
      const author = yield* signIn(
        yield* makeTestApiClient,
        testEmail("managed-primary@example.com"),
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
      const params = { walletId: wallet.id, label: "treasury" };
      yield* client.identity.create({ params, payload: { label: params.label } });
      const control = yield* OneClawTestControl;
      yield* Ref.set(control.calls, []);
      const prepared = yield* client.walletTransaction.prepare({
        params,
        headers: { "idempotency-key": "managed-primary" },
        payload: {
          namespace: "eip155",
          chainId: "eip155:1",
          calls: [
            {
              to: EthereumAddress.make("0x4444444444444444444444444444444444444444"),
              value: 0n,
              data: "0x1234",
            },
          ],
        },
      });
      expect(prepared.signing.method).toBe("server");
      expect(prepared.priceQuote).toBeNull();

      expect(yield* Ref.get(control.calls)).toEqual([]);
      const approval = {
        params,
        payload: { namespace: "eip155" as const, operationId: prepared.operationId },
      };
      expect((yield* client.walletTransaction.complete(approval)).status).toBe("signed");
      expect((yield* client.walletTransaction.complete(approval)).status).toBe("signed");
      expect(yield* Ref.get(control.calls)).toEqual(["signing.signDigest"]);
      yield* (yield* TestEvmExecution).setReceiptMode("failed");
      yield* TestClock.adjust(Duration.seconds(2));
      yield* (yield* Application).wallet.transactions.reconcile();
      expect((yield* client.identity.primaryStatus({ params })).operation?.status).toBe("failed");
    }),
  );
});
