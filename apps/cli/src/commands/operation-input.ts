import { Effect, Option, Predicate, Schema } from "effect";
import { Flag, Prompt } from "effect/cli";

import { SessionKeyId, SupportedEvmChainId, WalletId } from "@namera-ai/protocol";
import type { NameraClient } from "@namera-ai/sdk";

import { nameraCommand } from "#/commands/root";
import { CliFailure } from "#/services/error-feedback";
import { runPromise } from "#/services/output";
import { named, networkChoices, terminalText } from "#/services/output/document";

export const optionalInput = (name: string, description: string) =>
  Flag.String(name).pipe(Flag.withDescription(description), Flag.optional);

export const scopeFlags = {
  namespace: optionalInput("namespace", "Network type: evm (or eip155)"),
  wallet: optionalInput("wallet", "Wallet ID; omit to choose a wallet"),
  sessionKey: optionalInput("session-key", "Session key ID; omit to choose a key for the wallet"),
  network: optionalInput("network", "Network name, chain ID, or eip155 chain identifier"),
};

export type ScopeInput = { readonly [K in keyof typeof scopeFlags]: Option.Option<string> };

export const inputFailure = (message: string, nextStep: string) =>
  new CliFailure({ code: "INVALID_ARGUMENT", message, nextStep, retryable: false });

const inputHints: Readonly<Record<string, string>> = {
  namespace: "Use --namespace evm (or eip155). Other network types are not supported yet.",
  wallet: "Use a wallet ID from namera wallet list --output json, or omit --wallet to choose one.",
  "session-key":
    "Use a session key ID from namera session-key list --output json, or omit --session-key to choose one.",
  network: "Use a supported network name such as Base, its chain ID (8453), or eip155:8453.",
  to: "Use a full 0x-prefixed, 40-character Ethereum address for --to.",
  value: "Use a non-negative whole number of wei for --value. Use 0 when sending no native tokens.",
  data: "Use even-length 0x-prefixed hex for --data, or 0x for no calldata.",
  signature: "Copy the full 0x-prefixed hex signature into --signature.",
  type: "Use --type message or --type typed-data.",
  "typed-data":
    "Pass a valid EIP-712 JSON object with domain, types, primaryType, and message in --typed-data.",
  sponsor:
    "Use --sponsor true for sponsored gas, or --sponsor false with --max-gas-cost-wei to pay from the account.",
  "max-gas-cost-wei":
    "Set --max-gas-cost-wei to the largest non-negative whole wei amount you allow for gas.",
};

export const parseInput = <S extends Schema.Top>(schema: S, value: unknown, flag: string) =>
  Schema.decodeUnknownEffect(schema)(value).pipe(
    Effect.mapError(() =>
      inputFailure(
        `The value for --${flag} is invalid.`,
        inputHints[flag] ?? `Run this command with --help, correct --${flag}, and try again.`,
      ),
    ),
  );

export const ask = Effect.fnUntraced(function* <A, E, R>(
  flag: string,
  prompt: Effect.Effect<A, E, R>,
) {
  const { output, quiet } = yield* nameraCommand;
  if (output !== "pretty" || quiet || !process.stdin.isTTY || !process.stdout.isTTY) {
    return yield* inputFailure(
      `Missing --${flag}.`,
      `Provide --${flag}, or run this command in an interactive terminal without --output json or --quiet.`,
    );
  }
  return yield* prompt.pipe(
    Effect.catchIf(Predicate.isTagged("QuitError"), () => Effect.interrupt),
  );
});

export const inputOrPrompt = <S extends Schema.Top, E, R>(
  option: Option.Option<string>,
  flag: string,
  schema: S,
  prompt: Effect.Effect<S["Type"], E, R>,
) => (Option.isSome(option) ? parseInput(schema, option.value, flag) : ask(flag, prompt));

export const rejectMixedParams = (
  params: Option.Option<string>,
  inputs: readonly Option.Option<unknown>[],
) =>
  Option.isSome(params) && inputs.some(Option.isSome)
    ? Effect.fail(
        inputFailure(
          "Do not combine --params with individual input flags.",
          "Use either one complete --params JSON object or individual flags and prompts.",
        ),
      )
    : Effect.void;

export const resolveOperationScope = Effect.fnUntraced(function* (
  client: NameraClient,
  input: ScopeInput,
  needsSessionKey = true,
) {
  const namespaceInput = Option.isSome(input.namespace)
    ? input.namespace.value.toLowerCase()
    : yield* ask(
        "namespace",
        Prompt.run(
          Prompt.Select({
            message: "Choose a network type",
            choices: [
              { title: "EVM", description: "Ethereum and compatible networks", value: "evm" },
            ],
          }),
        ),
      );
  const namespace = yield* parseInput(
    Schema.Literal("eip155"),
    namespaceInput === "evm" ? "eip155" : namespaceInput,
    "namespace",
  );
  const walletId = Option.isSome(input.wallet)
    ? yield* parseInput(WalletId, input.wallet.value, "wallet")
    : yield* ask(
        "wallet",
        Effect.gen(function* () {
          const wallets = (yield* runPromise(client.wallets.list())).filter(
            (wallet) => wallet.namespace === namespace,
          );
          if (!wallets.length)
            return yield* inputFailure(
              "No accessible EVM wallets found.",
              "Create an account in the dashboard, then sign in and grant this profile wallet access.",
            );
          return yield* Prompt.run(
            Prompt.Select({
              message: "Choose a wallet",
              choices: wallets.map((wallet) => ({
                title: terminalText(named(wallet.metadata)),
                description: terminalText(wallet.address),
                value: wallet.id,
              })),
              maxPerPage: 8,
            }),
          );
        }),
      );
  const wallet = yield* runPromise(client.wallets.get(walletId));
  if (wallet.namespace !== namespace)
    return yield* inputFailure(
      "This wallet belongs to a different network type.",
      "Choose the wallet's namespace with --namespace, or select another wallet.",
    );

  const keyId = needsSessionKey
    ? Option.isSome(input.sessionKey)
      ? yield* parseInput(SessionKeyId, input.sessionKey.value, "session-key")
      : yield* ask(
          "session-key",
          Effect.gen(function* () {
            const keys = (yield* runPromise(client.sessionKeys.list({ walletId }))).filter(
              (key) => key.walletId === walletId && key.namespace === namespace,
            );
            if (!keys.length)
              return yield* inputFailure(
                "No accessible session keys for this wallet.",
                "Create and authorize a session key for this wallet in the dashboard, or choose another wallet.",
              );
            return yield* Prompt.run(
              Prompt.Select({
                message: "Choose a session key",
                choices: keys.map((key) => ({
                  title: terminalText(key.metadata.name),
                  description: terminalText(wallet.metadata.name),
                  value: key.id,
                })),
                maxPerPage: 8,
              }),
            );
          }),
        )
    : undefined;
  const key = keyId ? yield* runPromise(client.sessionKeys.get(keyId)) : undefined;
  if (key && (key.walletId !== walletId || key.namespace !== namespace)) {
    return yield* inputFailure(
      "This session key does not belong to the selected wallet and network type.",
      "Remove --session-key to choose a matching key, or correct --wallet and --namespace.",
    );
  }
  if (!needsSessionKey && Option.isSome(input.sessionKey))
    return yield* inputFailure(
      "Signature verification checks the wallet, not a session key.",
      "Remove --session-key. Verification does not prove which session key signed the message.",
    );
  const networkInput = Option.isSome(input.network)
    ? input.network.value
    : yield* ask(
        "network",
        Prompt.run(Prompt.Select({ message: "Choose a network", choices: networkChoices })),
      );
  const normalized =
    (
      {
        mainnet: "eip155:1",
        arbitrum: "eip155:42161",
        optimism: "eip155:10",
        "optimism-sepolia": "eip155:11155420",
      } as Readonly<Record<string, string>>
    )[networkInput.toLowerCase().trim().replaceAll(" ", "-")] ??
    networkChoices.find(
      (choice) =>
        choice.title.toLowerCase().replaceAll(" ", "-") ===
        networkInput.toLowerCase().trim().replaceAll(" ", "-"),
    )?.value ??
    (/^\d+$/.test(networkInput) ? `eip155:${networkInput}` : networkInput);
  const chainId = yield* parseInput(SupportedEvmChainId, normalized, "network");
  return { namespace, walletId, chainId, sessionKeyId: keyId, wallet, key };
});
