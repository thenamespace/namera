// oxlint-disable react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop
import type { SupportedEvmChainId } from "@namera-ai/protocol/evm";

import { EvmAddressPickerWithCustom } from "./evm-address-picker-with-custom";
import { CustomAddress } from "./evm-address-picker/custom-address";
import { AddressIdentity } from "./evm-address-picker/identity";
import type {
  AddressPickerFieldProps,
  EvmAddressValue,
  EvmCatalogType,
  EvmCustomAddress,
} from "./evm-address-picker/types";

export type EvmAddressPickerWithoutNetworkProps<T extends EvmCatalogType> = Omit<
  AddressPickerFieldProps,
  "chainIds"
> & {
  readonly chainId: SupportedEvmChainId;
  readonly types: readonly T[];
  readonly value: EvmAddressValue<NoInfer<T>, EvmCustomAddress> | null;
  readonly onChange: (value: EvmAddressValue<NoInfer<T>, EvmCustomAddress> | null) => void;
};

const renderCustomValue = (value: EvmCustomAddress) => (
  <AddressIdentity value={{ source: "custom", value }} compact />
);

export function EvmAddressPickerWithoutNetwork<const T extends EvmCatalogType>({
  chainId,
  ...props
}: EvmAddressPickerWithoutNetworkProps<T>) {
  return (
    <EvmAddressPickerWithCustom
      key={chainId}
      {...props}
      chainIds={[chainId]}
      renderCustomValue={renderCustomValue}
      renderCustom={(customProps) => (
        <CustomAddress {...customProps} mode="contract" fixedChainId={chainId} />
      )}
    />
  );
}
