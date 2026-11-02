import type { Schema } from "effect";

import type { CreateEvmSessionKeyRequest } from "@namera-ai/protocol/dto";
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";
import type { MetadataIcon } from "@namera-ai/protocol/model";

export type TemplateOutput = Pick<CreateEvmSessionKeyRequest, "onchain" | "policies">;

export type TemplateContext = { readonly now: number };

export type TemplateInput<T extends { readonly inputSchema: Schema.Top }> =
  T["inputSchema"]["Type"];

export type TemplateToken = {
  readonly id: string;
  readonly name: string;
  readonly symbol: string;
  readonly logo: string;
};

export type TemplateField<Name extends string = string> = {
  readonly name: Name;
  readonly label: string;
  readonly description?: string;
  readonly tooltip?: string;
} & (
  | { readonly kind: "networks"; readonly chainIds: readonly SupportedEvmChainId[] }
  | { readonly kind: "network"; readonly chainIds: readonly SupportedEvmChainId[] }
  | { readonly kind: "address"; readonly placeholder: string }
  | { readonly kind: "checkbox" }
  | { readonly kind: "amount"; readonly symbol: string; readonly decimals: number }
  | { readonly kind: "tokens"; readonly options: readonly TemplateToken[] }
  | { readonly kind: "expiry" }
);

type TemplateInputField<Input> = Input extends unknown
  ? TemplateField<Extract<keyof Input, string>>
  : never;

export type Template<S extends Schema.Top> = {
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
  readonly fields: readonly TemplateInputField<S["Encoded"]>[];
  readonly approvalNote?: string;
  readonly approvalNoteWhen?: readonly TemplateInputField<S["Encoded"]>["name"][];
  readonly build: (input: S["Type"], context: TemplateContext) => TemplateOutput;
};
