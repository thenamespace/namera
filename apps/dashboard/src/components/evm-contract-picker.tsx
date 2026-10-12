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

export type EvmContractSelection = EvmAddressValue<"contract", EvmCustomAddress>;
export type EvmContractPickerProps = AddressPickerFieldProps & {
  readonly value: EvmContractSelection | null;
  readonly onChange: (value: EvmContractSelection | null) => void;
};
const types = ["contract"] as const;
const renderCustom = (props: CustomAddressRenderProps<EvmCustomAddress>) => (
  <CustomAddress {...props} mode="contract" />
);
const renderCustomValue = (value: EvmCustomAddress) => (
  <AddressIdentity value={{ source: "custom", value }} compact />
);

export function EvmContractPicker(props: EvmContractPickerProps) {
  return (
    <EvmAddressPickerWithCustom
      {...props}
      types={types}
      renderCustom={renderCustom}
      renderCustomValue={renderCustomValue}
    />
  );
}
