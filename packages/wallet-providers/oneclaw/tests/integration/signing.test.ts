import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { OneClawAgentCredentialPayload } from "@namera-ai/protocol/model";
import { bytesToHex, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, vi } from "vitest";

import { OneClawService, type EthereumKey } from "../../src/index.js";
import {
  account,
  agent,
  authority,
  fetchMock,
  identity,
  key,
  Live,
  orgId,
  requestAt,
  respond,
  signerId,
} from "../fixtures/provider.js";

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());
const credential = Schema.decodeUnknownSync(OneClawAgentCredentialPayload)({
  version: 1,
  credentialId: signerId,
  organizationId: orgId,
  agentId: "agent",
  apiKey: "synthetic-agent-key",
});
const expected: EthereumKey = {
  id: key.id,
  agentId: key.agent_id,
  chain: "ethereum",
  curve: "secp256k1",
  publicKey: account.publicKey,
  address: account.address,
  version: 1,
};
const digest = `0x${"ab".repeat(32)}` as const;
const input = { credential, key: expected, digest: hexToBytes(digest) };
const authenticate = () => respond({ access_token: "synthetic-agent-token", expires_in: 900 });

it.effect("signs the exact digest and cryptographically verifies the expected public key", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    const signature = yield* Effect.promise(() => account.sign({ hash: digest }));
    authenticate();
    respond({ keys: [key] });
    respond({
      intent_type: "eip712_digest",
      chain: "ethereum",
      from: account.address,
      signature,
      typed_data_hash: digest,
    });
    expect(bytesToHex(yield* service.signing.signDigest(input))).toBe(signature);
    expect(requestAt(0).body).toEqual({ agent_id: "agent", api_key: "synthetic-agent-key" });
    expect(requestAt(0).headers.has("Authorization")).toBe(false);
    expect(requestAt(2).headers.get("Authorization")).toBe("Bearer synthetic-agent-token");
    expect(requestAt(2).body).toEqual({
      intent_type: "eip712_digest",
      chain: "ethereum",
      hash: digest,
    });
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects rotation and substituted or invalid key material before signing", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    for (const change of [
      { key_version: 2 },
      { agent_id: "other" },
      { id: "other" },
      { address: `0x${"00".repeat(20)}` },
      { public_key: `0x04${"00".repeat(64)}` },
      { custody: "client_tss" },
    ]) {
      authenticate();
      respond({ keys: [{ ...key, ...change }] });
      const error = yield* service.signing.signDigest(input).pipe(Effect.flip);
      expect(["KEY_MISMATCH", "INVALID_RESPONSE"]).toContain(error.code);
    }
    expect(fetchMock).toHaveBeenCalledTimes(12);
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects invalid signatures, wrong digests, and signatures from a different key", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    const wrongSigner = privateKeyToAccount(`0x${"02".repeat(32)}`);
    const signature = yield* Effect.promise(() => wrongSigner.sign({ hash: digest }));
    for (const change of [
      { signature },
      { signature: "0x12" },
      { signature, typed_data_hash: `0x${"00".repeat(32)}` },
    ]) {
      authenticate();
      respond({ keys: [key] });
      respond({
        intent_type: "eip712_digest",
        chain: "ethereum",
        from: account.address,
        typed_data_hash: digest,
        ...change,
      });
      const error = yield* service.signing.signDigest(input).pipe(Effect.flip);
      expect(["KEY_MISMATCH", "INVALID_RESPONSE"]).toContain(error.code);
    }
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects invalid digest length locally and does not retry rejected authentication", () =>
  Effect.gen(function* () {
    const service = yield* OneClawService;
    expect(
      (yield* service.signing
        .signDigest({ ...input, digest: new Uint8Array(31) })
        .pipe(Effect.flip)).code,
    ).toBe("INVALID_REQUEST");
    expect(fetchMock).not.toHaveBeenCalled();
    respond({ type: "unauthorized", detail: "synthetic-secret" }, 401);
    expect((yield* service.signing.signDigest(input).pipe(Effect.flip)).code).toBe(
      "UNAUTHENTICATED",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }).pipe(Effect.provide(Live)),
);

it.effect(
  "reads back raw-signing changes and surfaces approval without treating it as enabled",
  () =>
    Effect.gen(function* () {
      const service = yield* OneClawService;
      identity();
      respond(agent);
      respond(agent);
      yield* service.agents.setRawSigningEnabled({ authority, agentId: "agent", enabled: true });
      expect(requestAt(1).body).toEqual({ raw_signing_enabled: true });
      identity();
      respond({ status: "pending_approval" }, 202);
      expect(
        (yield* service.agents
          .setRawSigningEnabled({ authority, agentId: "agent", enabled: true })
          .pipe(Effect.flip)).code,
      ).toBe("APPROVAL_REQUIRED");
      identity();
      respond(agent);
      respond({ ...agent, raw_signing_policy: "approve" });
      expect(
        (yield* service.agents
          .setRawSigningEnabled({ authority, agentId: "agent", enabled: true })
          .pipe(Effect.flip)).code,
      ).toBe("APPROVAL_REQUIRED");
    }).pipe(Effect.provide(Live)),
);
