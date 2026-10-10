import { Effect } from "effect";

import type { CustomerAgent } from "#/agents";
import type { ClientContext } from "#/client";
import { oneClawError } from "#/errors";
import { validateKey } from "#/key-material";
import { KeyResponse, KeysResponse } from "#/responses";

export const makeSigningKeys = ({ request, customer }: ClientContext) => ({
  create: Effect.fn("wallet-providers.oneclaw.signingKeys.create")(function* (
    input: CustomerAgent,
  ) {
    const operation = "signingKeys.create";
    const authenticated = yield* customer(operation, input.authority);
    const key = yield* request(operation, KeyResponse, () =>
      authenticated.signingKeys.create(input.agentId, { chain: "ethereum" }),
    );
    return yield* validateKey(operation, input.agentId, key);
  }),
  list: Effect.fn("wallet-providers.oneclaw.signingKeys.list")(function* (input: CustomerAgent) {
    const operation = "signingKeys.list";
    const authenticated = yield* customer(operation, input.authority);
    const result = yield* request(operation, KeysResponse, () =>
      authenticated.signingKeys.list(input.agentId),
    );
    return yield* Effect.forEach(result.keys, (key) => validateKey(operation, input.agentId, key));
  }),
  destroy: () => Effect.fail(oneClawError("signingKeys.destroy", "UNSUPPORTED")),
});
