import type { ReactNode } from "react";

import type { CatalogEntryView } from "@namera-ai/protocol/dto";
import type { EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol/evm";

type Catalog = typeof CatalogEntryView.Type.catalog;
type Deployment = typeof CatalogEntryView.Type.entry;
export type EvmCatalogType = Catalog["data"]["type"];
export type EvmAddressSelection<T extends EvmCatalogType = EvmCatalogType> = {
  [K in T]: {
    readonly source: "catalog";
    readonly type: K;
    readonly catalog: Omit<Catalog, "data"> & {
      readonly data: Extract<Catalog["data"], { type: K }>;
    };
    readonly deployment: Omit<Deployment, "data"> & {
      readonly data: Extract<Deployment["data"], { type: K }>;
    };
  };
}[T];
export type EvmCustomAddress = {
  readonly chainId: SupportedEvmChainId;
  readonly address: EthereumAddress;
};
export type EvmAddressValue<T extends EvmCatalogType, C extends EvmCustomAddress> =
  | EvmAddressSelection<T>
  | { readonly source: "custom"; readonly value: C };

export type AddressPickerFieldProps = {
  readonly chainIds: readonly SupportedEvmChainId[];
  readonly label?: string;
  readonly id?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly "aria-describedby"?: string;
  readonly onBlur?: () => void;
};
export type EvmAddressPickerProps<T extends EvmCatalogType = EvmCatalogType> =
  AddressPickerFieldProps & {
    readonly types: readonly T[];
    readonly value: EvmAddressSelection<NoInfer<T>> | null;
    readonly onChange: (value: EvmAddressSelection<NoInfer<T>> | null) => void;
  };
export type CustomAddressRenderProps<C> = {
  readonly initialValue: C | null;
  readonly initialAddress: string;
  readonly chainIds: readonly SupportedEvmChainId[];
  readonly onConfirm: (value: C) => void;
  readonly onCancel: () => void;
};
export type EvmAddressPickerWithCustomProps<
  T extends EvmCatalogType,
  C extends EvmCustomAddress,
> = AddressPickerFieldProps & {
  readonly types: readonly T[];
  readonly value: EvmAddressValue<NoInfer<T>, C> | null;
  readonly onChange: (value: EvmAddressValue<NoInfer<T>, C> | null) => void;
  readonly renderCustom: (props: CustomAddressRenderProps<C>) => ReactNode;
  readonly renderCustomValue: (value: C) => ReactNode;
};
