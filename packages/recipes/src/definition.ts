import type { Schema } from "effect";

import type { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { MetadataIcon } from "@namera-ai/protocol/model";

export type RecipeOutput = Pick<CreateEvmSessionKeyRequest, "onchain" | "policies">;

export type RecipeToken = {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly logo: string;
  readonly description: string;
};

export type RecipeField<Name extends string = string> = {
  readonly name: Name;
  readonly label: string;
  readonly description?: string;
} & (
  | { readonly kind: "networks"; readonly chainIds: readonly SupportedEvmChainId[] }
  | { readonly kind: "amount"; readonly symbol: string; readonly decimals: number }
  | { readonly kind: "tokens"; readonly options: readonly RecipeToken[] }
  | { readonly kind: "expiry" }
);

type RecipeInputField<Input> = Input extends unknown
  ? RecipeField<Extract<keyof Input, string>>
  : never;

export type Recipe<S extends Schema.Top> = {
  readonly id: string;
  readonly version: number;
  readonly display: {
    readonly name: string;
    readonly description: string;
    readonly logo: string;
    readonly banner?: string;
    readonly tags: readonly string[];
  };
  readonly inputSchema: S;
  readonly metadata: {
    readonly name?: string;
    readonly description?: string;
    readonly logo?: MetadataIcon;
  };
  readonly defaults: S["Encoded"];
  readonly fields: readonly RecipeInputField<S["Encoded"]>[];
  readonly notice?: { readonly title: string; readonly description: string };
  readonly build: (input: unknown, context: { readonly now: number }) => RecipeOutput;
};
