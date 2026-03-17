import {
  type CallPolicyParams,
  CallPolicyVersion,
} from "@namera-ai/core/policy";
import { Effect, FileSystem } from "effect";
import type { QuitError } from "effect/Terminal";
import { Prompt } from "effect/unstable/cli";
import type { SelectChoice } from "effect/unstable/cli/Prompt";
import {
  type Abi,
  type AbiFunction,
  type Address,
  type Mutable,
  parseEther,
  toFunctionSelector,
} from "viem";

import { addressPrompt, etherPrompt } from "./common";

type Permissions = Mutable<NonNullable<CallPolicyParams["permissions"]>>;

const getEOAPermission = () =>
  Effect.gen(function* () {
    const target = yield* addressPrompt("Enter target address:");
    const valueLimit = yield* etherPrompt(
      "Max value that can be transferred (in ETH units):",
    );
    const weiUnits = parseEther(valueLimit, "wei");

    return [
      {
        target: target as Address,
        valueLimit: weiUnits,
      },
    ] satisfies Permissions;
  });

const getSmartContractPermission = () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const address = yield* addressPrompt("Enter smart contract address:");
    const maxLimit = yield* etherPrompt(
      "Max value that can be transferred (in ETH units)",
    );

    // 1. Get Abi File
    // TODO: Add Abi Validation
    const abiFilePath = yield* Prompt.file({
      message: "Select the ABI file for the smart contract",
    });

    const abiString = yield* fs.readFileString(abiFilePath).pipe(Effect.orDie);
    const abi = JSON.parse(abiString) as Abi;

    const functions = abi.filter((e) => e.type === "function");

    const allowedFunctions = yield* Prompt.multiSelect({
      choices: functions.map((f) => {
        let signature = `${f.name}(`;
        for (let i = 0; i < f.inputs.length; i++) {
          const sep =
            f.inputs.length === 0 || i === f.inputs.length - 1 ? "" : ", ";
          // biome-ignore lint/style/noNonNullAssertion: safe
          const input = f.inputs[i]!;
          signature += `${input.type}${input.name ? ` ${input.name}` : ""}${sep}`;
        }
        signature += ")";
        return {
          description: signature,
          title: f.name,
          value: f,
        } as SelectChoice<AbiFunction>;
      }),
      message: "Select the functions you want to allow",
      min: 1,
    });

    const weiUnits = parseEther(maxLimit);

    const res: Permissions = allowedFunctions.map((f) => {
      return {
        abi: [f],
        functionName: f.name,
        selector: toFunctionSelector(f),
        target: address as Address,
        valueLimit: weiUnits,
      };
    });

    return res;
  });

const getPermissions = () =>
  Effect.gen(function* () {
    const permissions: Permissions = [];

    const targetAddressPrompt = Prompt.select({
      choices: [
        {
          title: "EOA",
          value: "eoa",
        },
        {
          title: "Smart Contract",
          value: "smart-contract",
        },
      ],
      message: "Select target address type",
    });

    while (true) {
      if (permissions.length > 0) {
        const addMore = yield* Prompt.confirm({
          message: "Do you want to add another call permission?",
        });
        if (!addMore) break;
      }

      const targetAddress = yield* targetAddressPrompt;

      if (targetAddress === "eoa") {
        const res = yield* getEOAPermission();
        permissions.push(...res);
      } else {
        const res = yield* getSmartContractPermission();
        permissions.push(...res);
      }
    }

    return permissions;
  });

export const getCallPolicyParams: Effect.Effect<
  CallPolicyParams & { type: "call" },
  QuitError,
  Prompt.Environment
> = Effect.gen(function* () {
  const permissions = yield* getPermissions();

  return {
    permissions,
    policyVersion: CallPolicyVersion.V0_0_4,
    type: "call",
  };
});
