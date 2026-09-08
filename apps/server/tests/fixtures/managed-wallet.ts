import { Effect } from "effect";

import { Application } from "@namera-ai/application";
import type { CreateWalletRequest } from "@namera-ai/protocol/dto";

import { toWalletResponse } from "../../src/helpers/index.js";
import type { TestApiClient } from "./api.js";

/** Seed future managed custody through the application, never the beta HTTP route. */
export const createTestManagedWallet = Effect.fn("test.createManagedWallet")(function* (
  client: TestApiClient,
  input: { readonly payload: CreateWalletRequest },
) {
  const actor = yield* client.session.currentUser();
  const app = yield* Application;
  return toWalletResponse(
    yield* app.wallet.create({
      organizationId: actor.organization.id,
      actorId: actor.actorId,
      userId: actor.user.id,
      request: input.payload,
    }),
  );
});
