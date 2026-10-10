import { Context, Effect, Layer } from "effect";

import { makeAgents } from "#/agents";
import { makeClientContext } from "#/client";
import { makeConnections } from "#/connections";
import { makeCustomers } from "#/customers";
import { makeSigning } from "#/signing";
import { makeSigningKeys } from "#/signing-keys";

const makeOneClaw = Effect.gen(function* () {
  const context = yield* makeClientContext;
  return {
    connections: makeConnections(context),
    customers: makeCustomers(context),
    agents: makeAgents(context),
    signingKeys: makeSigningKeys(context),
    signing: makeSigning(context),
  };
});

export type OneClawOperations = Effect.Success<typeof makeOneClaw>;

export class OneClawService extends Context.Service<OneClawService, OneClawOperations>()(
  "@namera-ai/wallet-provider-oneclaw/OneClawService",
) {
  static readonly layer = Layer.effect(OneClawService, makeOneClaw);
}
