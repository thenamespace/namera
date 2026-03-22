import { Console, Effect, type Option, Schema } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import { GetSmartAccountStatusParams } from "@/dto";
import { getGlobalFlags } from "@/flags/global";
import { chainAndRpcUrl } from "@/flags/shared";
import { OutputFormatter, SmartAccountManager, Web3Service } from "@/layers";
import type { SupportedChain } from "@/schema/chain";

const handler = (
  flagAlias: Option.Option<string>,
  flagChain: Option.Option<SupportedChain>,
  flagRpcUrl: Option.Option<string>,
) =>
  Effect.gen(function* () {
    const web3Service = yield* Web3Service.Web3Service;
    const smartAccountManager = yield* SmartAccountManager.SmartAccountManager;
    const outputFormatter = yield* OutputFormatter.OutputFormatter;
    const globalFlags = yield* getGlobalFlags();

    let params: GetSmartAccountStatusParams;

    if (globalFlags.params._tag === "Some") {
      params = Schema.decodeUnknownSync(
        Schema.fromJsonString(GetSmartAccountStatusParams),
      )(globalFlags.params.value);
    } else {
      let alias: string;
      let chain: SupportedChain;
      const rpcUrl = flagRpcUrl._tag === "Some" ? flagRpcUrl.value : undefined;

      if (flagAlias._tag === "Some") {
        alias = flagAlias.value;
      } else {
        const res = yield* smartAccountManager.selectSmartAccount({
          message: "Select Smart Account:",
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

    const deployed = yield* smartAccountManager.getSmartAccountStatus(params);

    const data = { deployed };

    if (globalFlags.quite) return;

    const output = yield* outputFormatter.format(data, globalFlags.out);
    yield* Console.log(output);
  });

const alias = Flag.string("alias").pipe(
  Flag.withDescription("The alias of the smart account"),
  Flag.withAlias("a"),
  Flag.optional,
);

/**
 * Command that checks deployment status of a smart account on a chain.
 */
export const getSmartAccountStatus = Command.make(
  "status",
  {
    alias,
    ...chainAndRpcUrl,
  },
  ({ alias, chain, rpcUrl }) => handler(alias, chain, rpcUrl),
).pipe(
  Command.withDescription(
    "Get Smart Account Deployment Status for a given chain",
  ),
  Command.withExamples([
    {
      command: "namera smart-account status -a my-smart --chain eth-mainnet",
      description: "Get Smart Account Deployment Status for a given chain",
    },
    {
      command:
        "namera smart-account status --alias my-smart --chain eth-mainnet --rpc-url https://rpc.ankr.com/eth",
      description:
        "Get Smart Account Deployment Status for a given chain with custom RPC URL",
    },
    {
      command: `namera smart-account status --params '{"alias":"my-smart","chain":"eth-mainnet"}'`,
      description:
        "Get Smart Account Deployment Status for a given chain with json params",
    },
  ]),
);
