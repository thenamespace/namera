import {
  PermissionBuilder,
  installValidationActions,
  isModularAccountV2,
  SingleSignerValidationModule,
  toModularAccountV2Base,
} from "@alchemy/smart-accounts";
import { createClient, encodeAbiParameters, http, parseEther, parseEventLogs, toHex } from "viem";
import { entryPoint07Abi } from "viem/account-abstraction";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { describe, expect, it } from "vitest";

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
    const builder = new PermissionBuilder({
      client,
      key: { type: "secp256k1", publicKey: key.address },
      entityId: 1,
      nonce: 0n,
    }).addPermissions({
      permissions: [
        { type: "native-token-transfer", data: { allowance: toHex(allowance) } },
        { type: "contract-access", data: { address: recipient } },
      ],
    });
    const installation = await submit(account, await builder.compileRaw());
    expect(installation.status).toBe("success");
    const compiled = await builder.compileInstallArgs();
    const session = await toModularAccountV2Base({
      client: publicClient,
      owner: key,
      accountAddress: account.address,
      signerEntity: { entityId: 1, isGlobalValidation: false },
      getFactoryArgs: async () => ({}),
    });
    const before = await publicClient.getBalance({ address: recipient });
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

    const uninstall = await installValidationActions(client).encodeUninstallValidation({
      moduleAddress: compiled.validationConfig.moduleAddress,
      entityId: 1,
      uninstallData: SingleSignerValidationModule.encodeOnUninstallData({ entityId: 1 }),
      hookUninstallDatas: compiled.hooks.map(({ hookConfig }) =>
        encodeAbiParameters([{ type: "uint32" }], [hookConfig.entityId]),
      ),
    });
    const revoked = await submit(account, uninstall);
    expect(
      parseEventLogs({
        abi: entryPoint07Abi,
        eventName: "UserOperationEvent",
        logs: revoked.logs,
      })[0]?.args.success,
    ).toBe(true);
    await expect(
      submit(session, await session.encodeCalls([{ to: recipient, value: 0n }])),
    ).rejects.toThrow();
  }, 60_000);
});
