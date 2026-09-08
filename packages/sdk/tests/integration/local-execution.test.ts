import { Schema } from "effect";

import { PrepareExecutionResponse } from "@namera-ai/protocol/dto";
import { EthereumAddress, Bytes32 } from "@namera-ai/protocol/evm";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { NameraClient, type NameraFetch } from "../../src/index.js";
import { localExecutionFixture } from "../fixtures/local-execution.js";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });

const setup = () => {
  const fixture = localExecutionFixture();
  const account = privateKeyToAccount(generatePrivateKey());
  const signMessage = vi.fn(({ raw }: { readonly raw: `0x${string}` }) =>
    account.signMessage({ message: { raw } }),
  );
  const signer = {
    binding: { ...fixture.binding, signerAddress: EthereumAddress.make(account.address) },
    signMessage,
  };
  const completed = {
    namespace: "eip155",
    submissionId: fixture.response.submissionId,
    status: "prepared",
    userOperationHash: fixture.response.signing.message,
  };
  const fetch = vi
    .fn<NameraFetch>()
    .mockImplementationOnce(async () =>
      json(Schema.encodeSync(PrepareExecutionResponse)(fixture.response)),
    )
    .mockImplementation(async () => json(completed));
  return { ...fixture, signer, fetch, completed };
};

describe("local execution orchestration", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-08T12:01:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("prepares, signs raw bytes once and retries only identical completion after a lost response", async () => {
    const fixture = setup();
    fixture.fetch
      .mockReset()
      .mockImplementationOnce(async () =>
        json(Schema.encodeSync(PrepareExecutionResponse)(fixture.response)),
      )
      .mockRejectedValueOnce(new Error("response lost"))
      .mockImplementation(async () => json(fixture.completed));
    const client = new NameraClient({
      apiKey: "test-only",
      fetch: fixture.fetch,
      resolveSessionSigner: async () => fixture.signer,
    });
    expect(await client.executions.execute(fixture.request)).toEqual({
      success: true,
      data: fixture.completed,
      error: null,
    });
    expect(fixture.signer.signMessage).toHaveBeenCalledExactlyOnceWith({
      raw: fixture.response.signing.message,
    });
    expect(fixture.fetch.mock.calls.map(([url]) => String(url))).toEqual([
      "http://localhost:8080/executions/prepare",
      "http://localhost:8080/executions/complete",
      "http://localhost:8080/executions/complete",
    ]);
    expect(fixture.fetch.mock.calls[1]?.[1]?.body).toEqual(fixture.fetch.mock.calls[2]?.[1]?.body);
  });

  it("rejects a substituted hash before invoking the local signer", async () => {
    const fixture = setup();
    fixture.fetch.mockReset().mockImplementation(async () =>
      json(
        Schema.encodeSync(PrepareExecutionResponse)({
          ...fixture.response,
          signing: { method: "personal_sign", message: Bytes32.make(`0x${"00".repeat(32)}`) },
        }),
      ),
    );
    const client = new NameraClient({
      apiKey: "test-only",
      fetch: fixture.fetch,
      resolveSessionSigner: async () => fixture.signer,
    });
    expect(await client.executions.execute(fixture.request)).toMatchObject({
      success: false,
      error: { kind: "signer", code: "PREPARED_EXECUTION_INVALID" },
    });
    expect(fixture.signer.signMessage).not.toHaveBeenCalled();
    expect(fixture.fetch).toHaveBeenCalledOnce();
  });

  it("does not contact the server when no local signer is configured", async () => {
    const fixture = setup();
    const client = new NameraClient({ apiKey: "test-only", fetch: fixture.fetch });
    expect(await client.executions.execute(fixture.request)).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNER_REQUIRED" },
    });
    expect(fixture.fetch).not.toHaveBeenCalled();
  });

  it("does not submit signatures from a different local key", async () => {
    const fixture = setup();
    const wrongAccount = privateKeyToAccount(generatePrivateKey());
    const client = new NameraClient({
      apiKey: "test-only",
      fetch: fixture.fetch,
      resolveSessionSigner: async () => ({
        ...fixture.signer,
        signMessage: (message) => wrongAccount.signMessage({ message }),
      }),
    });
    expect(await client.executions.execute(fixture.request)).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNATURE_INVALID" },
    });
    expect(fixture.fetch).toHaveBeenCalledOnce();
  });

  it("does not submit if local signing outlives the preparation", async () => {
    const fixture = setup();
    const client = new NameraClient({
      apiKey: "test-only",
      fetch: fixture.fetch,
      resolveSessionSigner: async () => ({
        ...fixture.signer,
        signMessage: async (message) => {
          const signature = await fixture.signer.signMessage(message);
          vi.setSystemTime(new Date("2026-09-08T12:05:00Z"));
          return signature;
        },
      }),
    });
    expect(await client.executions.execute(fixture.request)).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNATURE_INVALID" },
    });
    expect(fixture.fetch).toHaveBeenCalledOnce();
  });

  it("redacts exceptions from private key storage", async () => {
    const fixture = setup();
    const client = new NameraClient({
      apiKey: "test-only",
      fetch: fixture.fetch,
      resolveSessionSigner: async () => {
        throw new Error("sensitive keystore diagnostic");
      },
    });
    const result = await client.executions.execute(fixture.request);
    expect(result).toMatchObject({
      success: false,
      error: { code: "LOCAL_SIGNER_UNAVAILABLE", cause: null },
    });
    expect(JSON.stringify(result)).not.toContain("sensitive keystore diagnostic");
    expect(fixture.fetch).not.toHaveBeenCalled();
  });
});
