import type { CatalogEntryView, SearchCatalogRequest } from "@namera-ai/protocol/dto";
import type { EthereumAddress, SupportedEvmChainId } from "@namera-ai/protocol/evm";

export type EvmAddressSelection = {
  readonly namespace: "eip155";
  readonly chainId: SupportedEvmChainId;
  readonly address: EthereumAddress;
} & (
  | { readonly source: "catalog"; readonly match: typeof CatalogEntryView.Type }
  | { readonly source: "custom" }
);

export type EvmAddressPickerProps = {
  readonly chainIds: readonly SupportedEvmChainId[];
  readonly types: NonNullable<SearchCatalogRequest["types"]>;
  readonly value: EvmAddressSelection | null;
  readonly onChange: (value: EvmAddressSelection | null) => void;
  readonly label?: string;
  readonly id?: string;
  readonly isDisabled?: boolean;
  readonly isInvalid?: boolean;
  readonly "aria-describedby"?: string;
  readonly onBlur?: () => void;
};
