import { Effect, Option, Schema } from "effect";

import { EthereumAddress, Hex, SessionKeyId } from "@namera-ai/protocol";
import type { NameraClient } from "@namera-ai/sdk";

import {
  ask,
  inputOrPrompt,
  optionalInput,
  parseInput,
  resolveOperationScope,
  scopeFlags,
  type ScopeInput,
} from "#/commands/operation-input";
import { CliPrompts } from "#/services/prompts";

export const transactionFlags = {
  ...scopeFlags,
  to: optionalInput("to", "Recipient or contract address"),
  value: optionalInput("value", "Native token amount in wei (0 for no transfer)"),
  data: optionalInput("data", "Hex calldata (0x for no calldata)"),
};

type TransactionInput = ScopeInput & {
  readonly to: Option.Option<string>;
  readonly value: Option.Option<string>;
  readonly data: Option.Option<string>;
};

export const transactionInput = Effect.fnUntraced(function* (
  client: NameraClient,
  input: TransactionInput,
) {
  const scope = yield* resolveOperationScope(client, input);
  const prompts = yield* CliPrompts;
  const to = yield* inputOrPrompt(
    input.to,
    "to",
    EthereumAddress,
    prompts.ethereumAddress("Recipient or contract address"),
  );
  const value = yield* inputOrPrompt(
    input.value,
    "value",
    Schema.BigIntFromString.check(Schema.isGreaterThanOrEqualToBigInt(0n)),
    prompts.ethereumValue(),
  );
  const data = yield* inputOrPrompt(input.data, "data", Hex, prompts.hex("Calldata (0x for none)"));
  const sessionKeyId = yield* parseInput(SessionKeyId, scope.sessionKeyId, "session-key");
  return {
    scope,
    request: {
      namespace: scope.namespace,
      walletId: scope.walletId,
      sessionKeyId,
      chainId: scope.chainId,
      calls: [{ to, value, data }],
    },
  };
});

export const sponsorshipInput = Effect.fnUntraced(function* (value: Option.Option<string>) {
  if (Option.isSome(value))
    return (
      (yield* parseInput(Schema.Literals(["true", "false"]), value.value, "sponsor")) === "true"
    );
  const prompts = yield* CliPrompts;
  return yield* ask("sponsor", prompts.confirm("Sponsor gas with Namera?", true));
});
