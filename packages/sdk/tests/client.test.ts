import { Schema } from "effect";

import { ExecutionSubmissionId, WalletId } from "@namera-ai/protocol";
import { EthereumAddress, UserOperationHash } from "@namera-ai/protocol/evm";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { NameraClient, type NameraFetch } from "../src/index.js";

const walletId = Schema.decodeSync(WalletId)("01a00407-5961-75cf-933e-9cfd0336ec16");
const submissionId = Schema.decodeSync(ExecutionSubmissionId)(
  "01a00427-5cb5-75be-9159-97eb6b3dca9d",
);
const address = Schema.decodeSync(EthereumAddress)("0x1111111111111111111111111111111111111111");
const userOperationHash = Schema.decodeSync(UserOperationHash)(
  "0x5220eca56a1918b04ebd0a4ca0f460f0e72dbcf639e00f9f8b5f6b5cb5365f86",
);
const submittedExecution = {
  namespace: "eip155",
  status: "submitted",
  submissionId,
  userOperationHash,
} as const;
const uuidV7Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("NameraClient", () => {
  it("constructs API-key reads and decodes successful responses", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(jsonResponse([]));

    const client = new NameraClient({
      apiKey: "nk_test_secret",
      baseUrl: "https://api.example.com/",
      fetch,
    });

    const result = await client.wallets.list();

    expect(result).toEqual({ success: true, data: [], error: null });
    const [url, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");

    expect(url?.toString()).toBe("https://api.example.com/wallets");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("nk_test_secret");
  });

  it("supports OAuth bearer credentials and lazy token resolution", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(jsonResponse([]));
    const getAccessToken = vi.fn().mockResolvedValue("oauth_access_token");
    const client = new NameraClient({ getAccessToken, fetch });

    await client.wallets.list();

    const [, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");
    expect(getAccessToken).toHaveBeenCalledOnce();
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer oauth_access_token",
    );
  });

  it("encodes execution input and returns the typed submitted result", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(jsonResponse(submittedExecution));
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.executions.execute({
      namespace: "eip155",
      walletId,
      chainId: "eip155:1",
      calls: [{ to: address, value: 0n, data: "0x" }],
    });

    expect(result).toMatchObject({
      success: true,
      data: { status: "submitted", submissionId },
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");

    const headers = init.headers as Record<string, string>;

    expect(url?.toString()).toBe("http://localhost:8080/executions");
    expect(init.method).toBe("POST");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["idempotency-key"]).toMatch(uuidV7Pattern);
    expect(JSON.parse(new TextDecoder().decode(init.body as Uint8Array))).toEqual({
      namespace: "eip155",
      walletId,
      chainId: "eip155:1",
      calls: [{ to: address, value: "0", data: "0x" }],
    });
  });

  it("simulates transactions without an idempotency header", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(
      jsonResponse({
        namespace: "eip155",
        walletId,
        chainId: "eip155:1",
        account: address,
        callsSucceeded: true,
        simulation: {
          userOperation: {
            source: "eth_estimateUserOperationGas",
            callGasLimit: "1",
            verificationGasLimit: "1",
            preVerificationGas: "1",
            paymasterVerificationGasLimit: "0",
            paymasterPostOpGasLimit: "0",
          },
          calls: {
            source: "viem.simulateCalls",
            results: [{ status: "success", returnData: "0x", gasUsed: "1" }],
            assetChanges: [],
            transfers: [],
          },
        },
        allowed: true,
        sessionKeyId: "01a00427-5cb5-75be-9159-97eb6b3dca9e",
      }),
    );
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.executions.simulate({
      namespace: "eip155",
      walletId,
      chainId: "eip155:1",
      calls: [{ to: address, value: 0n, data: "0x" }],
    });

    expect(result).toMatchObject({ success: true, data: { allowed: true } });
    const [url, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");
    expect(url?.toString()).toBe("http://localhost:8080/executions/simulate");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBeUndefined();
  });

  it("reuses one generated idempotency key across transient retries", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockResolvedValue(jsonResponse(submittedExecution));
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.executions.execute({
      namespace: "eip155",
      walletId,
      chainId: "eip155:1",
      calls: [{ to: address, value: 0n, data: "0x" }],
    });

    expect(result.success).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    const firstHeaders = fetch.mock.calls[0]?.[1]?.headers as Record<string, string>;
    const retryHeaders = fetch.mock.calls[1]?.[1]?.headers as Record<string, string>;
    expect(firstHeaders["idempotency-key"]).toMatch(uuidV7Pattern);
    expect(retryHeaders["idempotency-key"]).toBe(firstHeaders["idempotency-key"]);
  });

  it("generates signature idempotency internally", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(
      jsonResponse({
        namespace: "eip155",
        type: "message",
        walletId,
        chainId: "eip155:1",
        account: address,
        signature: "0x1234",
      }),
    );
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.sign({
      namespace: "eip155",
      type: "message",
      walletId,
      chainId: "eip155:1",
      message: "Sign with Namera",
    });

    expect(result.success).toBe(true);
    const [url, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");
    expect(url?.toString()).toBe("http://localhost:8080/signatures");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toMatch(uuidV7Pattern);
  });

  it("verifies smart-account signatures without an idempotency header", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(
      jsonResponse({
        namespace: "eip155",
        type: "message",
        walletId,
        chainId: "eip155:1",
        account: address,
        valid: true,
      }),
    );
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.verifySignature({
      namespace: "eip155",
      type: "message",
      walletId,
      chainId: "eip155:1",
      message: "Verify with Namera",
      signature: "0x1234",
    });

    expect(result).toMatchObject({ success: true, data: { valid: true } });
    const [url, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");
    expect(url?.toString()).toBe("http://localhost:8080/signatures/verify");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["idempotency-key"]).toBeUndefined();
  });

  it("does not retry declared API failures", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockResolvedValue(jsonResponse({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }, 429));
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.sign({
      namespace: "eip155",
      type: "message",
      walletId,
      chainId: "eip155:1",
      message: "Do not retry this request",
    });

    expect(result).toMatchObject({
      success: false,
      error: { kind: "api", tag: "RateLimitExceeded" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("returns structured API and response-contract failures", async () => {
    const apiFetch = vi.fn<NameraFetch>().mockResolvedValue(
      jsonResponse(
        {
          _tag: "WalletError",
          code: "WALLET_NOT_FOUND",
        },
        404,
      ),
    );
    const apiClient = new NameraClient({ apiKey: "nk_test_secret", fetch: apiFetch });

    const result = await apiClient.wallets.get(walletId);

    expect(result).toMatchObject({
      success: false,
      data: null,
      error: {
        kind: "api",
        status: null,
        tag: "WalletError",
        code: "WALLET_NOT_FOUND",
        message: "The wallet was not found or is not available to this authorization.",
        cause: expect.objectContaining({
          _tag: "WalletError",
          code: "WALLET_NOT_FOUND",
        }),
      },
    });

    if (!result.success && result.error.kind === "api") {
      // oxlint-disable-next-line no-underscore-dangle -- Effect tagged errors discriminate on `_tag`.
      if (result.error.cause._tag === "WalletError") {
        expectTypeOf(result.error.cause.code).toEqualTypeOf<"WALLET_NOT_FOUND">();
      }
    }

    const invalidClient = new NameraClient({
      apiKey: "nk_test_secret",
      fetch: vi.fn<NameraFetch>().mockResolvedValue(jsonResponse({ wallets: [] })),
    });
    expect(await invalidClient.wallets.list()).toMatchObject({
      success: false,
      error: { kind: "contract", status: null },
    });
  });

  it("returns network failures instead of rejecting", async () => {
    const client = new NameraClient({
      apiKey: "nk_test_secret",
      fetch: vi.fn<NameraFetch>().mockRejectedValue(new Error("offline")),
    });

    expect(await client.executions.getStatus(submissionId)).toMatchObject({
      success: false,
      data: null,
      error: { kind: "network", status: null },
    });
  });
});
