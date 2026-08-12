import { Effect } from "effect";

import type { KernelWalletData, SafeWalletData } from "@namera-ai/protocol/model";

import type { EvmConfigValues } from "../config.js";
import { createKernelAccount, type CreateKernelAccountProps } from "./kernel.js";
import { createSafeAccount, type CreateSafeAccountProps } from "./safe.js";

export type CreateAccountProps =
  | ({ readonly implementation: "kernel" } & CreateKernelAccountProps)
  | ({ readonly implementation: "safe" } & CreateSafeAccountProps);

export type CreateAccountResult<Props extends CreateAccountProps> = Props extends {
  readonly implementation: "kernel";
}
  ? KernelWalletData
  : Props extends { readonly implementation: "safe" }
    ? SafeWalletData
    : never;

export const makeCreateAccount = (config: EvmConfigValues) =>
  Effect.fn("Evm.createAccount")(function* <const Props extends CreateAccountProps>(props: Props) {
    if (props.implementation === "kernel") {
      return (yield* createKernelAccount(props, config)) as CreateAccountResult<Props>;
    }

    return (yield* createSafeAccount(props, config)) as CreateAccountResult<Props>;
  });

export * from "./webauthn.js";
