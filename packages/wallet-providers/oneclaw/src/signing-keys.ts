import { Effect, Schema } from "effect";

import { OneClawError } from "@namera-ai/protocol";

import type { CustomerAgent } from "#/agents";
import type { ClientContext } from "#/client";
import { validateKey } from "#/key-material";
import type { EthereumKey } from "#/key-material";
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
  deactivate: Effect.fn("wallet-providers.oneclaw.signingKeys.deactivate")(function* (
    input: CustomerAgent & {
      readonly key: Pick<EthereumKey, "id" | "version" | "publicKey">;
    },
  ) {
    const operation = "signingKeys.deactivate";
    const authenticated = yield* customer(operation, input.authority);
    const result = yield* request(operation, KeysResponse, () =>
      authenticated.signingKeys.list(input.agentId),
    );
    const active = result.keys.filter((key) => key.chain === "ethereum" && key.is_active);
    // Listing succeeds under customer authority. An absent active key also
    // reconciles a DELETE whose response was lost; a 404 alone is not evidence.
    if (active.length === 0) return;
    const candidate = active[0];
    if (active.length !== 1 || candidate === undefined)
      return yield* new OneClawError({ operation, code: "KEY_MISMATCH" });
    const key = yield* validateKey(operation, input.agentId, candidate);
    if (
      key.id !== input.key.id ||
      key.version !== input.key.version ||
      key.publicKey.toLowerCase() !== input.key.publicKey.toLowerCase()
    )
      return yield* new OneClawError({ operation, code: "KEY_MISMATCH" });

    yield* request(operation, Schema.Unknown, () =>
      authenticated.signingKeys.deactivate(input.agentId, "ethereum"),
    );
  }),
  destroy: () =>
    Effect.fail(new OneClawError({ operation: "signingKeys.destroy", code: "UNSUPPORTED" })),
});
