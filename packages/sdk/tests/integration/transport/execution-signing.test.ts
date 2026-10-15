import { Schema } from "effect";

import { CompleteExecutionRequest, PrepareExecutionRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it, vi } from "vitest";

import { NameraClient, type NameraFetch } from "../../../src/index.js";
import { jsonResponse } from "../../fixtures/http.js";

const prepare = Schema.decodeUnknownSync(PrepareExecutionRequest)({
  namespace: "eip155",
  walletId: "01950000-0000-7000-8000-000000000001",
  sessionKeyId: "01950000-0000-7000-8000-000000000002",
  chainId: "eip155:11155111",
  calls: [{ to: `0x${"11".repeat(20)}`, value: "1000000000000000000", data: "0x" }],
  sponsor: false,
});
const complete = Schema.decodeUnknownSync(CompleteExecutionRequest)({
  namespace: "eip155",
  submissionId: "01950000-0000-7000-8000-000000000003",
  signature: `0x${"11".repeat(64)}1b`,
});

describe("detached execution transport", () => {
  it.each([
    { failure: "connection reset", respond: () => Promise.reject(new Error("connection reset")) },
    {
      failure: "declared server error",
      respond: () => Promise.resolve(jsonResponse({ _tag: "InternalServerError" }, 500)),
    },
    ...[408, 500, 502, 503, 504].map((status) => ({
      failure: `raw HTTP ${status}`,
      respond: () => Promise.resolve(new Response("upstream unavailable", { status })),
    })),
  ])(
    "retries $failure with one preparation identity and unchanged payload",
    async ({ respond }) => {
      const fetch = vi
        .fn<NameraFetch>()
        .mockImplementationOnce(respond)
        .mockImplementation(async () =>
          jsonResponse({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }, 429),
        );
      const client = new NameraClient({ apiKey: "test-only", fetch });

      expect(await client.executions.prepare(prepare)).toMatchObject({
        success: false,
        error: { kind: "api", tag: "RateLimitExceeded" },
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      const requests = fetch.mock.calls.map(([url, init]) => {
        expect(url.toString()).toBe("https://api.namera.ai/executions/prepare");
        expect(init?.method).toBe("POST");
        expect(JSON.parse(new TextDecoder().decode(init?.body as Uint8Array))).toEqual(
          Schema.encodeSync(PrepareExecutionRequest)(prepare),
        );
        return new Headers(init?.headers).get("idempotency-key");
      });
      expect(requests[0]).toMatch(/^[0-9a-f-]{36}$/u);
      expect(requests[1]).toBe(requests[0]);
    },
  );

  it("bounds retries and gives a distinct preparation a fresh identity", async () => {
    const fetch = vi.fn<NameraFetch>().mockRejectedValue(new Error("offline"));
    const client = new NameraClient({ apiKey: "test-only", fetch });

    expect(await client.executions.prepare(prepare)).toMatchObject({
      success: false,
      error: { kind: "network" },
    });
    expect(fetch).toHaveBeenCalledTimes(4);
    const keys = fetch.mock.calls.map(([, init]) =>
      new Headers(init?.headers).get("idempotency-key"),
    );
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/u);
    expect(new Set(keys).size).toBe(1);

    fetch
      .mockClear()
      .mockImplementation(async () =>
        jsonResponse({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }, 429),
      );
    await client.executions.prepare(prepare);

    expect(fetch).toHaveBeenCalledOnce();
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get("idempotency-key")).not.toBe(keys[0]);
  });

  it("does not retry a malformed successful preparation", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockImplementation(async () => jsonResponse({ namespace: "eip155" }));
    const client = new NameraClient({ apiKey: "test-only", fetch });

    expect(await client.executions.prepare(prepare)).toMatchObject({
      success: false,
      error: { kind: "contract" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("exhausts raw gateway retries without changing the completion signature", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockImplementation(async () => new Response("Bad Gateway", { status: 502 }));
    const client = new NameraClient({ apiKey: "test-only", fetch });

    expect(await client.executions.complete(complete)).toMatchObject({
      success: false,
      error: { status: 502 },
    });
    expect(fetch).toHaveBeenCalledTimes(4);
    for (const [url, init] of fetch.mock.calls) {
      expect(url.toString()).toBe("https://api.namera.ai/executions/complete");
      expect(JSON.parse(new TextDecoder().decode(init?.body as Uint8Array))).toEqual(complete);
    }
  });

  it("retries completion with the same signature and returns queued, not confirmed", async () => {
    const response = {
      namespace: "eip155",
      submissionId: complete.submissionId,
      status: "prepared",
      userOperationHash: `0x${"22".repeat(32)}`,
    };
    const fetch = vi
      .fn<NameraFetch>()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockImplementation(async () => jsonResponse(response));
    const client = new NameraClient({ apiKey: "test-only", fetch });

    expect(await client.executions.complete(complete)).toEqual({
      success: true,
      data: response,
      error: null,
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetch.mock.calls) {
      expect(url.toString()).toBe("https://api.namera.ai/executions/complete");
      expect(new Headers(init?.headers).has("idempotency-key")).toBe(false);
      expect(JSON.parse(new TextDecoder().decode(init?.body as Uint8Array))).toEqual(complete);
    }
  });

  it("returns declared completion errors without retrying or falling back to execution", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockImplementation(async () =>
        jsonResponse({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }, 429),
      );
    const client = new NameraClient({ apiKey: "test-only", fetch });
    expect(await client.executions.complete(complete)).toMatchObject({
      success: false,
      error: { kind: "api", tag: "RateLimitExceeded" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
