import { createPublicClient, custom, encodeAbiParameters, type Hex } from "viem";
import { describe, expect, it, vi } from "vitest";

import { reviewSubregistry } from "../../../src/identity/subregistry-review.js";

const registry = "0x2222222222222222222222222222222222222222";
const account = "0x1111111111111111111111111111111111111111";
const boolResult = (value: boolean) => encodeAbiParameters([{ type: "bool" }], [value]);
const roleResult = (value: bigint) => encodeAbiParameters([{ type: "uint256" }], [value]);

function rpcClient({
  code = "0x6000",
  supports = boolResult(true),
  roles = roleResult(1n),
}: {
  code?: Hex;
  supports?: Hex;
  roles?: Hex;
} = {}) {
  const request = vi.fn(
    async ({ method, params }: { method: string; params?: readonly unknown[] }) => {
      if (method === "eth_blockNumber") return "0x123";
      if (method === "eth_getCode") return code;
      if (method === "eth_call") {
        const call = params?.[0] as { data: Hex };
        // ERC-165 supportsInterface(bytes4); roles(uint256,address).
        if (call.data.startsWith("0x01ffc9a7")) return supports;
        return roles;
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    },
  );
  return {
    client: createPublicClient({ transport: custom({ request }, { retryCount: 0 }) }),
    request,
  };
}

describe("ENSv2 subregistry preflight", () => {
  it("checks the exact registry/account and registrar bit at one uncached block", async () => {
    const { client, request } = rpcClient({ roles: roleResult(5n) });
    expect(await reviewSubregistry({ registry, account }, client)).toBe("ready");

    const calls = request.mock.calls.map(([call]) => call);
    expect(calls).toHaveLength(4);
    expect(calls[0]?.method).toBe("eth_blockNumber");
    expect(calls[1]).toEqual({ method: "eth_getCode", params: [registry, "0x123"] });
    expect(calls[2]?.params).toEqual([
      {
        to: registry,
        data: `0x01ffc9a7c18bd555${"0".repeat(56)}`,
      },
      "0x123",
    ]);
    const roleCall = calls[3]?.params?.[0] as { to: string; data: string };
    expect(roleCall.to).toBe(registry);
    expect(roleCall.data.slice(0, 10)).toBe("0x5adf4724");
    expect(roleCall.data.slice(10)).toBe(`${"0".repeat(64)}${account.slice(2).padStart(64, "0")}`);
    expect(calls[3]?.params?.[1]).toBe("0x123");
  });

  it.each([
    [{ code: "0x" as Hex }, "not-contract"],
    [{ supports: boolResult(false) }, "not-registry"],
    [{ supports: "0x" as Hex }, "not-registry"],
    [{ roles: roleResult(0n) }, "missing-role"],
    [{ roles: roleResult(2n) }, "missing-role"],
  ] as const)(
    "blocks unsupported contracts and absent registrar authority: %j",
    async (options, expected) => {
      const { client } = rpcClient(options);
      expect(await reviewSubregistry({ registry, account }, client)).toBe(expected);
    },
  );

  it("propagates RPC failures rather than treating them as role denials", async () => {
    const { client, request } = rpcClient();
    request.mockRejectedValue(new Error("RPC offline"));
    await expect(reviewSubregistry({ registry, account }, client)).rejects.toThrow("RPC offline");
  });
});
