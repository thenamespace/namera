import { expect, it } from "@effect/vitest";
import { Effect, Schema } from "effect";

import { OneClawAgentCredentialPayload } from "@namera-ai/protocol/model";
import { bytesToHex, hexToBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { OneClawService, type EthereumKey } from "../../src/index.js";
import {
  account,
  agent,
  authority,
  ProviderHttp,
  key,
  Live,
  orgId,
  signerId,
} from "../fixtures/provider.js";

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
const token = { access_token: "synthetic-agent-token", expires_in: 900 };

it.effect("exchanges the agent credential again for each signature", () =>
  Effect.gen(function* () {
    const { fetchMock, respond, requestAt } = yield* ProviderHttp;
    const service = yield* OneClawService;
    const signature = yield* Effect.promise(() => account.sign({ hash: digest }));

    for (const [index, accessToken] of ["first-token", "second-token"].entries()) {
      respond({ ...token, access_token: accessToken });
      respond({ keys: [key] });
      respond({
        intent_type: "eip712_digest",
        chain: "ethereum",
        from: account.address,
        typed_data_hash: digest,
        signature,
      });
      expect(bytesToHex(yield* service.signing.signDigest(input))).toBe(signature);
      expect(requestAt(index * 3).body).toEqual({
        agent_id: "agent",
        api_key: "synthetic-agent-key",
      });
      expect(requestAt(index * 3 + 2).headers.get("Authorization")).toBe(`Bearer ${accessToken}`);
    }
    expect(fetchMock).toHaveBeenCalledTimes(6);
  }).pipe(Effect.provide(Live)),
);

it.effect("signs the exact digest and cryptographically verifies the expected public key", () =>
  Effect.gen(function* () {
    const { respond, requestAt } = yield* ProviderHttp;
    const service = yield* OneClawService;
    const signature = yield* Effect.promise(() => account.sign({ hash: digest }));
    respond(token);
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

it.effect.each([
  { name: "rotated version", change: { key_version: 2 }, code: "KEY_MISMATCH" },
  { name: "another agent", change: { agent_id: "other" }, code: "KEY_MISMATCH" },
  { name: "another key", change: { id: "other" }, code: "KEY_MISMATCH" },
  {
    name: "substituted address",
    change: { address: `0x${"00".repeat(20)}` },
    code: "KEY_MISMATCH",
  },
  {
    name: "invalid curve point",
    change: { public_key: `0x04${"00".repeat(64)}` },
    code: "INVALID_RESPONSE",
  },
  { name: "client custody", change: { custody: "client_tss" }, code: "KEY_MISMATCH" },
  { name: "inactive key", change: { is_active: false }, code: "KEY_MISMATCH" },
] as const)("rejects $name before signing", ({ change, code }) =>
  Effect.gen(function* () {
    const { fetchMock, respond } = yield* ProviderHttp;
    const service = yield* OneClawService;
    respond(token);
    respond({ keys: [{ ...key, ...change }] });
    const error = yield* service.signing.signDigest(input).pipe(Effect.flip);
    expect(error).toMatchObject({ code, operation: "signing.signDigest" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }).pipe(Effect.provide(Live)),
);

it.effect.each([
  { name: "another signer", code: "KEY_MISMATCH" },
  { name: "truncated signature", code: "INVALID_RESPONSE" },
  { name: "another digest", code: "KEY_MISMATCH" },
  { name: "another sender", code: "KEY_MISMATCH" },
  { name: "invalid recovery byte", code: "INVALID_RESPONSE" },
] as const)("rejects a signing response with $name", ({ name, code }) =>
  Effect.gen(function* () {
    const { fetchMock, respond } = yield* ProviderHttp;
    const service = yield* OneClawService;
    const wrongSigner = privateKeyToAccount(`0x${"02".repeat(32)}`);
    const signature = yield* Effect.promise(() => account.sign({ hash: digest }));
    const response = {
      intent_type: "eip712_digest",
      chain: "ethereum",
      from: account.address,
      typed_data_hash: digest,
      signature,
    };
    let change: Readonly<Record<string, string>>;
    switch (name) {
      case "another signer":
        change = { signature: yield* Effect.promise(() => wrongSigner.sign({ hash: digest })) };
        break;
      case "truncated signature":
        change = { signature: "0x12" };
        break;
      case "another digest":
        change = { typed_data_hash: `0x${"00".repeat(32)}` };
        break;
      case "another sender":
        change = { from: wrongSigner.address };
        break;
      case "invalid recovery byte":
        change = { signature: `${signature.slice(0, -2)}ff` };
        break;
    }
    respond(token);
    respond({ keys: [key] });
    respond({ ...response, ...change });
    const error = yield* service.signing.signDigest(input).pipe(Effect.flip);
    expect(error).toMatchObject({ code, operation: "signing.signDigest" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }).pipe(Effect.provide(Live)),
);

it.effect("rejects invalid digest length locally and does not retry rejected authentication", () =>
  Effect.gen(function* () {
    const { fetchMock, respond } = yield* ProviderHttp;
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
      const { respond, identity, requestAt } = yield* ProviderHttp;
      const service = yield* OneClawService;
      identity();
      respond(agent);
      respond(agent);
      yield* service.agents.setRawSigningEnabled({ authority, agentId: "agent", enabled: true });
      expect(requestAt(1).body).toEqual({ raw_signing_enabled: true, raw_signing_policy: "allow" });
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
