import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { GetSessionKeyStatusParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { chainAndRpcUrl } from "@/flags/shared";
import { OutputFormatter, SessionKeyManager, Web3Service } from "@/layers";
import type { SupportedChain } from "@/schema/chain";

const handler = (
  flagAlias: Option.Option<string>,
  flagChain: Option.Option<SupportedChain>,
  flagRpcUrl: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const web3Service = yield* Web3Service.Web3Service;
    const sessionKeyManager = yield* SessionKeyManager.SessionKeyManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: GetSessionKeyStatusParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(GetSessionKeyStatusParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let chain: SupportedChain;
      const rpcUrl = flagRpcUrl._tag === "Some" ? flagRpcUrl.value : undefined;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        const res = yield* sessionKeyManager.selectSessionKey({
          message: "Select Session Key:",
        });
        alias = res.alias;
      }

      if (flagChain._tag === "Some") {
        chain = flagChain.value;
      } else {
        chain = yield* web3Service.selectChain({
          message: "Select Chain:",
        });
      }

      params = { alias, chain, rpcUrl };
    }

    const installed = yield* sessionKeyManager.getSessionKeyStatus(params);

    const data = { installed };

    if (globalFlags.quiet) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the session key"),
  Flag.withAlias("a"),
  Flag.optional,
);

export const getSessionKeyStatusCommand = Command.make(
  "status",
  {
    alias,
    ...chainAndRpcUrl,
  },
  ({ alias, chain, rpcUrl }) => handler(alias, chain, rpcUrl),
).pipe(
  Command.withDescription("Get Session key status for a given chain"),
  Command.withExamples([
    {
      command: "namera session-key status -a my-smart --chain eth-mainnet",
      description: "Get Session key status for a given chain",
    },
    {
      command:
        "namera session-key status --alias my-smart --chain eth-mainnet --rpc-url https://rpc.ankr.com/eth",
      description:
        "Get Session key status for a given chain with custom RPC URL",
    },
    {
      command: `namera session-key status --params '{"alias":"my-session-key","chain":"eth-mainnet"}'`,
      description: "Get Session key status for a given chain with json params",
    },
    {
      command: "namera schema session-key.status",
      description: "Get the schema for the session key status command",
    },
  ]),
);
