import {
  NameraClient,
  type ExecuteRequest,
  type NameraFetch,
  type PrepareSignatureRequest,
} from "@namera-ai/sdk";
import { parseEther } from "viem";
import { describe, expect, it, vi } from "vitest";

const walletId: string = "01950000-0000-7000-8000-000000000001";
const sessionKeyId: string = "01950000-0000-7000-8000-000000000002";
const operationId: string = "01950000-0000-7000-8000-000000000003";
const address = "0x2222222222222222222222222222222222222222";
const execution = {
  namespace: "eip155",
  walletId,
  sessionKeyId,
  chainId: "eip155:84532",
  calls: [{ to: address, value: parseEther("0.001"), data: "0x" }],
  sponsor: true,
} satisfies ExecuteRequest;
const message = {
  namespace: "eip155",
  walletId,
  sessionKeyId,
  chainId: "eip155:84532",
  type: "message",
  message: "Hello from Namera",
} satisfies PrepareSignatureRequest;
const typedData = {
  ...message,
  type: "typed-data",
  typedData: {
    domain: {
      name: "Namera test",
      version: "1",
      chainId: 84532,
      verifyingContract: address,
      salt: `0x${"11".repeat(32)}`,
    },
    types: { Greeting: [{ name: "text", type: "string" }] },
    primaryType: "Greeting",
    message: { text: "Hello from Namera" },
  },
} satisfies PrepareSignatureRequest;

const setup = () => {
  const fetch = vi.fn<NameraFetch>().mockImplementation(
    async () =>
      new Response(JSON.stringify({ _tag: "RateLimitExceeded", retryAfterSeconds: 60 }), {
        status: 429,
        headers: { "content-type": "application/json" },
      }),
  );
  const resolveSessionSigner = vi.fn();
  const client = new NameraClient({ apiKey: "test-only", fetch, resolveSessionSigner });
  return { fetch, resolveSessionSigner, client };
};

const bodyOf = (fetch: ReturnType<typeof setup>["fetch"]) =>
  JSON.parse(new TextDecoder().decode(fetch.mock.calls[0]?.[1]?.body as Uint8Array));

describe("SDK input boundary", () => {
  it.each(["prepare", "simulate", "execute"] as const)(
    "%s encodes a plain address and bigint amount without protocol imports",
    async (method) => {
      const { client, fetch } = setup();
      await client.executions[method](execution);
      expect(fetch).toHaveBeenCalledOnce();
      expect(bodyOf(fetch)).toMatchObject({
        walletId,
        sessionKeyId,
        chainId: "eip155:84532",
        calls: [{ to: address, value: "1000000000000000", data: "0x" }],
      });
      expect(execution.calls[0]?.value).toBe(parseEther("0.001"));
    },
  );

  it("accepts plain nested typed-data addresses and bytes for signing and verification", async () => {
    const { client, fetch } = setup();
    await client.sign(typedData);
    expect(bodyOf(fetch).typedData).toEqual(typedData.typedData);
    fetch.mockClear();
    await client.verifySignature({ ...typedData, signature: "0x1234" });
    expect(bodyOf(fetch).typedData).toEqual(typedData.typedData);
  });

  it("accepts plain IDs in reads, filters, and detached completions", async () => {
    const { client, fetch } = setup();
    await client.wallets.get(walletId);
    await client.sessionKeys.get(sessionKeyId);
    await client.sessionKeys.list({ walletId });
    await client.executions.get(operationId);
    await client.executions.getStatus(operationId);
    await client.executions.list({ cursor: operationId, walletId, sessionKeyId });
    await client.executions.complete({ namespace: "eip155", submissionId: operationId });
    await client.signatures.complete({ namespace: "eip155", operationId });
    expect(fetch).toHaveBeenCalledTimes(8);
    expect(String(fetch.mock.calls[0]?.[0])).toContain(`/wallets/${walletId}`);
    expect(String(fetch.mock.calls[5]?.[0])).toContain(`cursor=${operationId}`);
  });

  it.each([
    { walletId: "not-an-id" },
    { sessionKeyId: "not-an-id" },
    { namespace: "solana" },
    { chainId: "eip155:137" },
    { calls: [] },
    { calls: [{ to: "0x1234", value: 0n, data: "0x" }] },
    { calls: [{ to: address, value: -1n, data: "0x" }] },
    { calls: [{ to: address, value: 1, data: "0x" }] },
    { calls: [{ to: address, value: "1", data: "0x" }] },
    { calls: [{ to: address, value: 0n, data: "0xzz" }] },
  ])("rejects invalid execution input %# before fetch or signing", async (invalid) => {
    const { client, fetch, resolveSessionSigner } = setup();
    const input = { ...execution, ...invalid } as unknown as ExecuteRequest;
    const results = await Promise.all(
      (["prepare", "simulate", "execute"] as const).map((method) =>
        client.executions[method](input),
      ),
    );
    for (const result of results) {
      expect(result).toMatchObject({
        success: false,
        error: { kind: "contract" },
      });
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(resolveSessionSigner).not.toHaveBeenCalled();
  });

  it.each([
    { name: "wallet lookup", call: (client: NameraClient) => client.wallets.get("invalid") },
    { name: "session lookup", call: (client: NameraClient) => client.sessionKeys.get("invalid") },
    {
      name: "session wallet filter",
      call: (client: NameraClient) => client.sessionKeys.list({ walletId: "invalid" }),
    },
    { name: "execution lookup", call: (client: NameraClient) => client.executions.get("invalid") },
    {
      name: "execution status",
      call: (client: NameraClient) => client.executions.getStatus("invalid"),
    },
    {
      name: "execution cursor",
      call: (client: NameraClient) => client.executions.list({ cursor: "invalid" }),
    },
    {
      name: "execution wallet filter",
      call: (client: NameraClient) => client.executions.list({ walletId: "invalid" }),
    },
    {
      name: "execution session filter",
      call: (client: NameraClient) => client.executions.list({ sessionKeyId: "invalid" }),
    },
    {
      name: "execution completion signature",
      call: (client: NameraClient) =>
        client.executions.complete({
          namespace: "eip155",
          submissionId: operationId,
          signature: "0x12",
        }),
    },
    {
      name: "signature completion",
      call: (client: NameraClient) =>
        client.signatures.complete({ namespace: "eip155", operationId: "invalid" }),
    },
    {
      name: "signature preparation",
      call: (client: NameraClient) =>
        client.signatures.prepare({ ...message, sessionKeyId: "invalid" }),
    },
    {
      name: "message signing",
      call: (client: NameraClient) => client.sign({ ...message, walletId: "invalid" }),
    },
    {
      name: "signature verification",
      call: (client: NameraClient) => client.verifySignature({ ...message, signature: "0xzz" }),
    },
    {
      name: "typed-data domain",
      call: (client: NameraClient) =>
        client.sign({
          ...typedData,
          typedData: { ...typedData.typedData, domain: { verifyingContract: "0x1234" } },
        }),
    },
  ])("rejects malformed $name before fetch or signer access", async ({ call }) => {
    const { client, fetch, resolveSessionSigner } = setup();
    expect(await call(client)).toMatchObject({ success: false, error: { kind: "contract" } });
    expect(fetch).not.toHaveBeenCalled();
    expect(resolveSessionSigner).not.toHaveBeenCalled();
  });
});
