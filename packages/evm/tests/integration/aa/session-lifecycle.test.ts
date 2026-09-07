import { Schema } from "effect";

import {
  AllowlistModule,
  DefaultModuleAddress,
  isModularAccountV2,
  toModularAccountV2Base,
} from "@alchemy/smart-accounts";
import { EvmSessionAuthorization } from "@namera-ai/protocol/evm";
import { createClient, http, parseEther, parseEventLogs } from "viem";
import { entryPoint07Abi } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { describe, expect, it } from "vitest";

import { compileEvmSession } from "../../../src/sessions/compile.js";
import { makeAnvilFixture } from "./fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;

describe.skipIf(anvilUrl === undefined)("real onchain session lifecycle", () => {
  it("installs a local session, enforces its native budget and revokes it", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { account, publicClient, submit } = await makeAnvilFixture(anvilUrl);
    if (!isModularAccountV2(account)) throw new Error("Expected a Modular Account V2");
    const client = createClient({ account, chain: sepolia, transport: http(anvilUrl) });
    const key = privateKeyToAccount(generatePrivateKey());
    const recipient = "0x0000000000000000000000000000000000002345";
    const allowance = parseEther("0.002");
    const now = Number((await publicClient.getBlock()).timestamp);
    const authorization = Schema.decodeUnknownSync(EvmSessionAuthorization)({
      version: 1,
      entityId: 1,
      signerAddress: key.address,
      validAfter: now - 60,
      validUntil: now + 3600,
      permissions: [
        { type: "native-token-transfer", allowance: allowance.toString() },
        { type: "contract-access", address: recipient },
      ],
    });
    const compiled = await compileEvmSession(client, authorization);
    const installation = await submit(
      account,
      await account.encodeCalls([{ to: account.address, data: compiled.installCallData }]),
    );
    expect(installation.status).toBe("success");
    expect(
      await publicClient.readContract({
        address: DefaultModuleAddress.ALLOWLIST,
        abi: AllowlistModule.abi,
        functionName: "addressAllowlist",
        args: [1, recipient, account.address],
      }),
    ).toEqual([true, false, false]);
    const session = await toModularAccountV2Base({
      client: publicClient,
      owner: key,
      accountAddress: account.address,
      signerEntity: { entityId: 1, isGlobalValidation: false },
      getFactoryArgs: async () => ({}),
    });
    const before = await publicClient.getBalance({ address: recipient });
    await expect(
      submit(
        session,
        await session.encodeCalls([
          { to: "0x0000000000000000000000000000000000009999", value: 0n },
        ]),
      ),
    ).rejects.toThrow();
    const successful = await submit(
      session,
      await session.encodeCalls([{ to: recipient, value: allowance }]),
    );
    const events = parseEventLogs({
      abi: entryPoint07Abi,
      eventName: "UserOperationEvent",
      logs: successful.logs,
    });
    expect(events[0]?.args.success).toBe(true);
    expect(await publicClient.getBalance({ address: recipient })).toBe(before + allowance);

    const overBudget = await submit(
      session,
      await session.encodeCalls([{ to: recipient, value: 1n }]),
    );
    expect(
      parseEventLogs({
        abi: entryPoint07Abi,
        eventName: "UserOperationEvent",
        logs: overBudget.logs,
      })[0]?.args.success,
    ).toBe(false);
    expect(await publicClient.getBalance({ address: recipient })).toBe(before + allowance);

    const revoked = await submit(
      account,
      await account.encodeCalls([{ to: account.address, data: compiled.uninstallCallData }]),
    );
    expect(
      parseEventLogs({
        abi: entryPoint07Abi,
        eventName: "UserOperationEvent",
        logs: revoked.logs,
      })[0]?.args.success,
    ).toBe(true);
    expect(
      await publicClient.readContract({
        address: DefaultModuleAddress.ALLOWLIST,
        abi: AllowlistModule.abi,
        functionName: "addressAllowlist",
        args: [1, recipient, account.address],
      }),
    ).toEqual([false, false, false]);
    await expect(
      submit(session, await session.encodeCalls([{ to: recipient, value: 0n }])),
    ).rejects.toThrow();
  }, 60_000);

  it("rejects a local signer before activation and after onchain expiry", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { account, publicClient, submit, advanceTime } = await makeAnvilFixture(anvilUrl);
    const client = createClient({ account, chain: sepolia, transport: http(anvilUrl) });
    const key = privateKeyToAccount(generatePrivateKey());
    const recipient = "0x0000000000000000000000000000000000003456";
    const now = Number((await publicClient.getBlock()).timestamp);
    const compiled = await compileEvmSession(
      client,
      Schema.decodeUnknownSync(EvmSessionAuthorization)({
        version: 1,
        entityId: 2,
        signerAddress: key.address,
        validAfter: now + 300,
        validUntil: now + 600,
        permissions: [{ type: "contract-access", address: recipient }],
      }),
    );
    await submit(account, compiled.installCallData);
    const session = await toModularAccountV2Base({
      client: publicClient,
      owner: key,
      accountAddress: account.address,
      signerEntity: { entityId: 2, isGlobalValidation: false },
      getFactoryArgs: async () => ({}),
    });
    const callData = await session.encodeCalls([{ to: recipient, value: 0n }]);
    await expect(submit(session, callData)).rejects.toThrow();
    await advanceTime(301);
    const receipt = await submit(session, callData);
    expect(
      parseEventLogs({
        abi: entryPoint07Abi,
        eventName: "UserOperationEvent",
        logs: receipt.logs,
      })[0]?.args.success,
    ).toBe(true);
    await advanceTime(301);
    await expect(submit(session, callData)).rejects.toThrow();
  }, 60_000);
});
