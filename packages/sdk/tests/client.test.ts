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

  it("encodes execution input and returns the typed submitted result", async () => {
    const fetch = vi.fn<NameraFetch>().mockResolvedValue(
      jsonResponse({
        namespace: "eip155",
        status: "submitted",
        submissionId,
        userOperationHash,
      }),
    );
    const client = new NameraClient({ apiKey: "nk_test_secret", fetch });

    const result = await client.executions.execute(
      {
        namespace: "eip155",
        walletId,
        chainId: "eip155:1",
        calls: [{ to: address, value: 0n, data: "0x" }],
      },
      { idempotencyKey: "transfer-1" },
    );

    expect(result).toMatchObject({
      success: true,
      data: { status: "submitted", submissionId },
    });
    const [url, init] = fetch.mock.calls[0] ?? [];
    if (init === undefined) throw new Error("Expected a fetch request");

    const headers = init.headers as Record<string, string>;

    expect(url?.toString()).toBe("https://api.namera.ai/executions");
    expect(init.method).toBe("POST");
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["idempotency-key"]).toBe("transfer-1");
    expect(JSON.parse(new TextDecoder().decode(init.body as Uint8Array))).toEqual({
      namespace: "eip155",
      walletId,
      chainId: "eip155:1",
      calls: [{ to: address, value: "0", data: "0x" }],
    });
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
        message: "The Namera API rejected the request.",
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

    expect(await client.executions.getSubmission(submissionId)).toMatchObject({
      success: false,
      data: null,
      error: { kind: "network", status: null },
    });
  });
});
