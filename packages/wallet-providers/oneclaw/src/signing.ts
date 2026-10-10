import { Effect, Redacted, Schema } from "effect";

import { OneClawAgentCredentialPayload } from "@namera-ai/protocol/model";
import { bytesToHex } from "viem";

import type { ClientContext } from "#/client";
import { oneClawError } from "#/errors";
import { type EthereumKey, validateKey, verifyDigestSignature } from "#/key-material";
import { KeysResponse, SignResponse, TokenResponse } from "#/responses";

export const makeSigning = ({ anonymous, client, request }: ClientContext) => ({
  signDigest: Effect.fn("wallet-providers.oneclaw.signing.signDigest")(function* (input: {
    readonly credential: OneClawAgentCredentialPayload;
    readonly key: EthereumKey;
    readonly digest: Uint8Array;
  }) {
    const operation = "signing.signDigest";
    yield* Schema.decodeUnknownEffect(Schema.toType(OneClawAgentCredentialPayload))(
      input.credential,
    ).pipe(Effect.mapError(() => oneClawError(operation, "INVALID_REQUEST")));
    if (input.digest.length !== 32) return yield* oneClawError(operation, "INVALID_REQUEST");
    const agentId = input.credential.agentId;
    if (
      input.key.agentId !== agentId ||
      input.key.chain !== "ethereum" ||
      input.key.curve !== "secp256k1"
    ) {
      return yield* oneClawError(operation, "KEY_MISMATCH");
    }
    // Explicit exchange preserves typed HTTP failures. SDK automatic refresh
    // throws unstructured errors containing provider bodies. No token is persisted.
    const token = yield* request(operation, TokenResponse, () =>
      anonymous.auth.agentToken({
        agent_id: agentId,
        api_key: Redacted.value(input.credential.apiKey),
      }),
    );
    const authenticated = client(token.access_token);
    const keys = yield* request(operation, KeysResponse, () =>
      authenticated.signingKeys.list(agentId),
    );
    const matching = keys.keys.filter((key) => key.chain === "ethereum" && key.is_active);
    const remote = matching[0];
    if (matching.length !== 1 || remote === undefined || remote.id !== input.key.id)
      return yield* oneClawError(operation, "KEY_MISMATCH");
    const key = yield* validateKey(operation, agentId, remote);
    if (
      key.version !== input.key.version ||
      key.publicKey.toLowerCase() !== input.key.publicKey.toLowerCase() ||
      key.address.toLowerCase() !== input.key.address.toLowerCase()
    )
      return yield* oneClawError(operation, "KEY_MISMATCH");
    const digest = bytesToHex(input.digest);
    const response = yield* request(operation, SignResponse, () =>
      authenticated.agents.sign(agentId, {
        chain: "ethereum",
        intent_type: "eip712_digest",
        hash: digest,
      }),
    );
    return yield* verifyDigestSignature(key, digest, response);
  }),
});
