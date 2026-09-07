import { Effect } from "effect";

import { EthereumAddress, Hex } from "@namera-ai/protocol";
import * as Signature from "ox/Signature";
import { parseEventLogs, parseEther, hashMessage } from "viem";
import { entryPoint07Abi } from "viem/account-abstraction";
import { describe, expect, it } from "vitest";

import { makeEvmOwnerApproval } from "../../../src/execution/owner-approval.js";
import type { SignEvmExecutionInput } from "../../../src/execution/types.js";
import { normalizeEvmUserOperation } from "../../../src/execution/user-operation.js";
import { preparedExecutionFixture } from "../../fixtures/prepared-execution.js";
import { makeAnvilFixture } from "./fixture.js";

const anvilUrl = process.env.NAMERA_TEST_ANVIL_URL;

describe.skipIf(anvilUrl === undefined)("real Modular Account V2 on a Sepolia Anvil fork", () => {
  it("deploys a P-256 account with a detached owner approval and rejects another operation's approval", async () => {
    if (anvilUrl === undefined) throw new Error("NAMERA_TEST_ANVIL_URL is required");
    const { account, owner, reconstruction, publicClient, submit } =
      await makeAnvilFixture(anvilUrl);
    const approval = makeEvmOwnerApproval(() => ({ publicClient }));
    const recipient = "0x0000000000000000000000000000000000001234";
    const before = await publicClient.getBalance({ address: recipient });
    const amount = parseEther("0.001");
    const calls = [{ to: EthereumAddress.make(recipient), value: amount, data: Hex.make("0x") }];
    const receipt = await submit(account, await account.encodeCalls(calls), async (operation) => {
      const input: SignEvmExecutionInput = {
        account: reconstruction,
        prepared: preparedExecutionFixture(
          await Effect.runPromise(normalizeEvmUserOperation(operation)),
          calls,
        ),
      };
      const challenge = await Effect.runPromise(approval.challenge(input));
      const response = await owner.sign({ hash: challenge });
      const assertion = {
        authenticatorDataHex: response.webauthn.authenticatorData,
        clientDataJSON: response.webauthn.clientDataJSON,
        signatureDerHex: Signature.toDerHex(Signature.fromHex(response.signature)),
      };
      const other = await owner.sign({ hash: hashMessage("a different operation") });
      const rejection = await Effect.runPromise(
        approval
          .complete({
            ...input,
            assertion: { ...assertion, clientDataJSON: other.webauthn.clientDataJSON },
          })
          .pipe(Effect.flip),
      );
      expect(rejection).toMatchObject({ _tag: "EvmExecutionError", code: "SIGNING_FAILED" });
      const tampered = await Effect.runPromise(
        approval
          .complete({
            ...input,
            assertion,
            prepared: {
              ...input.prepared,
              userOperation: {
                ...input.prepared.userOperation,
                callGasLimit: operation.callGasLimit + 1n,
              },
            },
          })
          .pipe(Effect.flip),
      );
      expect(tampered).toMatchObject({ _tag: "EvmExecutionError", code: "SIGNING_FAILED" });
      return (await Effect.runPromise(approval.complete({ ...input, assertion }))).userOperation
        .signature;
    });
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
