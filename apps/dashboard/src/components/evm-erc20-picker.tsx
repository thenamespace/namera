// oxlint-disable react-perf/jsx-no-new-object-as-prop
import { EvmAddressPickerWithCustom } from "./evm-address-picker-with-custom";
import { CustomAddress } from "./evm-address-picker/custom-address";
import { AddressIdentity } from "./evm-address-picker/identity";
import type {
  AddressPickerFieldProps,
  CustomAddressRenderProps,
  EvmAddressValue,
  EvmCustomAddress,
} from "./evm-address-picker/types";

export type CustomErc20Value = EvmCustomAddress & { readonly decimals: number };
export type EvmErc20Selection = EvmAddressValue<"erc20", CustomErc20Value>;
export type EvmErc20PickerProps = AddressPickerFieldProps & {
  readonly value: EvmErc20Selection | null;
  readonly onChange: (value: EvmErc20Selection | null) => void;
};
const types = ["erc20"] as const;
const renderCustom = (props: CustomAddressRenderProps<CustomErc20Value>) => (
  <CustomAddress {...props} mode="erc20" />
);
const renderCustomValue = (value: CustomErc20Value) => (
  <AddressIdentity value={{ source: "custom", value }} compact />
);

export function EvmErc20Picker(props: EvmErc20PickerProps) {
  return (
    <EvmAddressPickerWithCustom
      {...props}
      types={types}
      renderCustom={renderCustom}
      renderCustomValue={renderCustomValue}
    />
  );
}
