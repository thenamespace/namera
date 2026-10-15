import { Effect } from "effect";

import { NameraApi } from "@namera-ai/api";

import { handledApi } from "./http-api-test.js";
import { makeTestApiClient, resetTestState, signIn, testEmail } from "./index.js";
import { createTestPasskeyWallet } from "./local-session.js";

export const setupPasskeyWalletOwner = Effect.fn("test.wallet.setupPasskeyOwner")(function* (
  scenario: string,
) {
  yield* resetTestState();
  const author = yield* signIn(
    yield* makeTestApiClient,
    testEmail(`${scenario}-${crypto.randomUUID()}@example.com`),
  );
  const client = yield* handledApi(NameraApi, {
    headers: { cookie: `auth-token=${author.cookie.value}`, origin: "http://dashboard.test" },
  });
  const wallet = yield* createTestPasskeyWallet(client);

  return { client, author, wallet, params: { walletId: wallet.id } };
});
