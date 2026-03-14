import { Effect, FileSystem, Option, Schema } from "effect";
import { Prompt } from "effect/unstable/cli";
import type { SelectChoice } from "effect/unstable/cli/Prompt";
import {
  type Abi,
  type AbiFunction,
  type Address,
  parseEther,
  toFunctionSelector,
} from "viem";

import { EthereumAddress } from "@/schema";

import type { CallPolicyData } from "./types";

export const addressPrompt = Prompt.text({
  message: "Enter target address",
  validate: (value) =>
    Effect.gen(function* () {
      const res = Schema.decodeUnknownOption(EthereumAddress)(value);
      if (Option.isNone(res))
        return yield* Effect.fail("Invalid Ethereum Address");
      return value;
    }),
});

export const maxLimitPrompt = (message: string) =>
  Prompt.text({
    message,
    validate: (val) =>
      Effect.gen(function* () {
        const schema = Schema.NumberFromString.check(
          Schema.isGreaterThanOrEqualTo(0),
        );
        const res = Schema.decodeOption(schema)(val);
        if (Option.isNone(res)) return yield* Effect.fail("Invalid Number");
        return res.value.toString();
      }),
  });

export const getCallPolicyParams = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const targetAddress = yield* Prompt.select({
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

  // EOA
  if (targetAddress === "eoa") {
    const target = yield* addressPrompt;
    const valueLimit = yield* maxLimitPrompt(
      "Max value that can be transferred (in ETH units)",
    );
    const weiUnits = parseEther(valueLimit, "wei").toString();
    return [
      {
        data: { target: target as Address, valueLimit: weiUnits },
        type: "call",
      } satisfies CallPolicyData,
    ];
  }

  // Smart Contract
  const address = yield* addressPrompt;
  const maxLimit = yield* maxLimitPrompt(
    "Max value that can be transferred (in ETH units)",
  );
  // 1. Get Abi File
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
          f.inputs.length === 0 || i === f.inputs.length - 1 ? "" : ",";
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

  // TODO: More stuff for smart contracts, like function signature, etc.

  const weiUnits = parseEther(maxLimit).toString();

  const res = allowedFunctions.map((f) => {
    return {
      data: {
        abi,
        functionName: f.name,
        selector: toFunctionSelector(f),
        target: address as Address,
        valueLimit: weiUnits,
      },
      type: "call",
    } satisfies CallPolicyData;
  });

  return res;
});
