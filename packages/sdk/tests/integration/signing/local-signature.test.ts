import { DateTime, Schema } from "effect";

import {
  DefaultModuleAddress,
  toReplaySafeTypedData,
  pack1271Signature,
} from "@alchemy/smart-accounts";
import { PrepareSignatureRequest, PrepareSignatureResponse } from "@namera-ai/protocol/dto";
import { EthereumAddress } from "@namera-ai/protocol/evm";
import { concatHex, hashMessage, hashTypedData, type TypedDataDefinition } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { NameraClient, type NameraFetch } from "../../../src/index.js";
import { localExecutionFixture } from "../../fixtures/local-execution.js";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
const fixture = (type: "message" | "typed-data" = "message") => {
  const execution = localExecutionFixture();
  const account = privateKeyToAccount(generatePrivateKey());
  const now = DateTime.nowUnsafe();
  const binding = {
    ...execution.binding,
    signerAddress: EthereumAddress.make(account.address),
    allowSignatures: true,
    validAfter: DateTime.subtract(now, { minutes: 1 }),
    validUntil: DateTime.add(now, { hours: 1 }),
  };
  const request = Schema.decodeUnknownSync(PrepareSignatureRequest)({
    namespace: "eip155",
    walletId: binding.walletId,
    sessionKeyId: binding.sessionKeyId,
    chainId: binding.chainId,
    ...(type === "message"
      ? { type, message: "Approve this message only" }
      : {
          type,
          typedData: {
            domain: { name: "Test" },
            types: { Note: [{ name: "text", type: "string" }] },
            primaryType: "Note",
            message: { text: "hello" },
          },
        }),
  });
  const hash =
    request.type === "message"
      ? hashMessage(request.message)
      : hashTypedData(request.typedData as unknown as TypedDataDefinition);
  const typedData = toReplaySafeTypedData({
    address: DefaultModuleAddress.SINGLE_SIGNER_VALIDATION,
    chainId: 11155111,
    hash,
    salt: concatHex([`0x${"00".repeat(12)}`, binding.walletAddress]),
  });
  const response = Schema.decodeUnknownSync(PrepareSignatureResponse)({
    namespace: "eip155",
    operationId: "01950000-0000-7000-8000-000000000009",
    installationId: binding.installationId,
    signingKeyId: binding.signingKeyId,
    request: Schema.encodeSync(PrepareSignatureRequest)(request),
    signing: { method: "eth_signTypedData_v4", typedData },
    expiresAt: DateTime.toDateUtc(DateTime.add(now, { minutes: 5 })),
  });
  if (response.signing.method !== "eth_signTypedData_v4")
    throw new Error("Expected local challenge");
  return { account, binding, request, response: { ...response, signing: response.signing } };
};

describe("local session signatures", () => {
  it.each(["message", "typed-data"] as const)(
    "signs managed %s without a local key or alternate endpoint",
    async (type) => {
      const f = fixture(type);
      const fetch = vi
        .fn<NameraFetch>()
        .mockImplementationOnce(async () =>
          json(
            Schema.encodeSync(PrepareSignatureResponse)({
              ...f.response,
              signing: { method: "server" },
            }),
          ),
        )
        .mockImplementation(async () =>
          json({
            namespace: "eip155",
            walletId: f.request.walletId,
            chainId: f.request.chainId,
            account: f.binding.walletAddress,
            type,
            signature: "0x1234",
          }),
        );
      const resolveSessionSigner = vi.fn();
      const client = new NameraClient({ apiKey: "test-only", fetch, resolveSessionSigner });
      expect((await client.sign(f.request)).success).toBe(true);
      expect(resolveSessionSigner).not.toHaveBeenCalled();
      expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([
        "https://api.namera.ai/signatures/prepare",
        "https://api.namera.ai/signatures/complete",
      ]);
      expect(
        JSON.parse(new TextDecoder().decode(fetch.mock.calls[1]?.[1]?.body as Uint8Array)),
      ).toEqual({ namespace: "eip155", operationId: f.response.operationId });
    },
  );

  it("does not retry managed signing after an ambiguous completion", async () => {
    const f = fixture();
    const fetch = vi
      .fn<NameraFetch>()
      .mockImplementationOnce(async () =>
        json(
          Schema.encodeSync(PrepareSignatureResponse)({
            ...f.response,
            signing: { method: "server" },
          }),
        ),
      )
      .mockRejectedValue(new Error("response lost"));
    const client = new NameraClient({ apiKey: "test-only", fetch });
    expect((await client.sign(f.request)).success).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each(["message", "typed-data"] as const)(
    "signs %s once across response-loss retries",
    async (type) => {
      const f = fixture(type);
      const signTypedData = vi.fn((typedData: TypedDataDefinition) =>
        f.account.signTypedData(typedData),
      );
      const prepareKeys: (string | null)[] = [];
      const completions: string[] = [];
      const fetch = vi.fn<NameraFetch>(async (url, init) => {
        if (url.toString().endsWith("/prepare")) {
          prepareKeys.push(new Headers(init?.headers).get("idempotency-key"));
          if (prepareKeys.length === 1) throw new Error("response lost");
          return json(Schema.encodeSync(PrepareSignatureResponse)(f.response));
        }
        expect(url.toString()).toContain("/signatures/complete");
        completions.push(new TextDecoder().decode(init?.body as Uint8Array));
        if (completions.length === 1) throw new Error("completion lost");
        return json({
          namespace: "eip155",
          walletId: f.binding.walletId,
          chainId: f.binding.chainId,
          account: f.binding.walletAddress,
          type,
          signature: pack1271Signature({
            entityId: f.binding.entityId,
            validationSignaturePrefix: "0x00",
            validationSignature: JSON.parse(completions[0] ?? "{}").signature,
          }),
        });
      });
      const client = new NameraClient({
        apiKey: "test-only",
        fetch,
        resolveSessionSigner: async () => ({
          binding: f.binding,
          signMessage: async () => {
            throw new Error("wrong signing method");
          },
          signTypedData,
        }),
      });
      expect((await client.sign(f.request)).success).toBe(true);
      expect(signTypedData).toHaveBeenCalledOnce();
      expect(prepareKeys[0]).toMatch(/^[0-9a-f-]{36}$/);
      expect(prepareKeys[1]).toBe(prepareKeys[0]);
      expect(completions[1]).toBe(completions[0]);
    },
  );

  it.each(["payload", "domain", "installation", "expiry"])(
    "rejects changed %s before signing",
    async (change) => {
      const f = fixture();
      const encoded = Schema.encodeSync(PrepareSignatureResponse)(f.response);
      if (encoded.signing.method !== "eth_signTypedData_v4")
        throw new Error("Expected local challenge");
      const response =
        change === "payload"
          ? { ...encoded, request: { ...encoded.request, message: "substituted" } }
          : change === "domain"
            ? {
                ...encoded,
                signing: {
                  ...encoded.signing,
                  typedData: { ...encoded.signing.typedData, domain: { chainId: 1 } },
                },
              }
            : change === "installation"
              ? { ...encoded, installationId: "01950000-0000-7000-8000-000000000008" }
              : { ...encoded, expiresAt: new Date(0) };
      const signTypedData = vi.fn((typedData: TypedDataDefinition) =>
        f.account.signTypedData(typedData),
      );
      const fetch = vi.fn<NameraFetch>(async () => json(response));
      const client = new NameraClient({
        apiKey: "test-only",
        fetch,
        resolveSessionSigner: async () => ({
          binding: f.binding,
          signMessage: async () => "0x",
          signTypedData,
        }),
      });
      expect(await client.sign(f.request)).toMatchObject({
        success: false,
        error: { code: "PREPARED_SIGNATURE_INVALID" },
      });
      expect(signTypedData).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledOnce();
    },
  );

  it("refuses local bindings without explicit signature consent", async () => {
    const f = fixture();
    const fetch = vi.fn<NameraFetch>(async () =>
      json(Schema.encodeSync(PrepareSignatureResponse)(f.response)),
    );
    const client = new NameraClient({
      apiKey: "test-only",
      fetch,
      resolveSessionSigner: async () => ({
        binding: { ...f.binding, allowSignatures: false },
        signMessage: async () => "0x",
        signTypedData: f.account.signTypedData,
      }),
    });
    expect(await client.sign(f.request)).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNER_REQUIRED" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("rejects a signature from the wrong local key without completing", async () => {
    const f = fixture();
    const other = privateKeyToAccount(generatePrivateKey());
    const fetch = vi.fn<NameraFetch>(async () =>
      json(Schema.encodeSync(PrepareSignatureResponse)(f.response)),
    );
    const client = new NameraClient({
      apiKey: "test-only",
      fetch,
      resolveSessionSigner: async () => ({
        binding: f.binding,
        signMessage: async () => "0x",
        signTypedData: other.signTypedData,
      }),
    });
    expect(await client.sign(f.request)).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNATURE_INVALID", cause: null },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("does not expose local keystore exceptions", async () => {
    const f = fixture();
    const fetch = vi.fn<NameraFetch>(async () =>
      json(Schema.encodeSync(PrepareSignatureResponse)(f.response)),
    );
    const client = new NameraClient({
      apiKey: "test-only",
      fetch,
      resolveSessionSigner: async () => {
        throw new Error("sensitive keystore details");
      },
    });
    const result = await client.sign(f.request);
    expect(result).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNER_UNAVAILABLE", cause: null },
    });
    expect(JSON.stringify(result)).not.toContain("sensitive");
    expect(fetch).toHaveBeenCalledOnce();
  });
});
