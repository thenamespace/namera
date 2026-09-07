import { parseEventLogs, parseEther } from "viem";
import { entryPoint07Abi } from "viem/account-abstraction";
import { describe, expect, it } from "vitest";

import { makeAnvilFixture } from "./fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;

describe.skipIf(anvilUrl === undefined)("real Modular Account V2 on a Sepolia Anvil fork", () => {
  it("deploys a P-256 account and executes through the real EntryPoint", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { account, publicClient, submit } = await makeAnvilFixture(anvilUrl);
    const recipient = "0x0000000000000000000000000000000000001234";
    const before = await publicClient.getBalance({ address: recipient });
    const amount = parseEther("0.001");
    const receipt = await submit(
      account,
      await account.encodeCalls([{ to: recipient, value: amount }]),
    );
    expect(receipt.status).toBe("success");
    const operationEvents = parseEventLogs({
      abi: entryPoint07Abi,
      eventName: "UserOperationEvent",
      logs: receipt.logs.filter(
        (log) => log.address.toLowerCase() === account.entryPoint.address.toLowerCase(),
      ),
    });
    expect(operationEvents).toHaveLength(1);
    expect(operationEvents[0]?.args.success).toBe(true);
    expect(await publicClient.getBalance({ address: recipient })).toBe(before + amount);
    expect(await publicClient.getCode({ address: account.address })).not.toBeUndefined();
  }, 60_000);
});
