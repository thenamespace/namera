import { Schema } from "effect";

import { CompleteExecutionRequest, PrepareExecutionRequest } from "@namera-ai/protocol/dto";
import { describe, expect, it, vi } from "vitest";

import { NameraClient, type NameraFetch } from "../../../src/index.js";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

describe("detached execution transport", () => {
  it("retries preparation with one generated key and preserves the selected session", async () => {
    const fetch = vi
      .fn<NameraFetch>()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockImplementation(async () =>
        json({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }, 429),
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
      .mockImplementation(async () => json(response));
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
        json({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }, 429),
      );
    const client = new NameraClient({ apiKey: "test-only", fetch });
    expect(await client.executions.complete(complete)).toMatchObject({
      success: false,
      error: { kind: "api", tag: "RateLimitExceeded" },
    });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
