// oxlint-disable react-perf/jsx-no-jsx-as-prop
import { AddressPickerControl } from "./control";
import { AddressIdentity } from "./identity";
import type { EvmAddressPickerProps, EvmCatalogType } from "./types";
export type {
  EvmAddressPickerProps,
  EvmAddressSelection,
  EvmCatalogType,
  EvmCustomAddress,
  EvmAddressValue,
} from "./types";

export function EvmAddressPicker<const T extends EvmCatalogType>({
  value,
  onChange,
  ...props
}: EvmAddressPickerProps<T>) {
  const eligible =
    value &&
    props.chainIds.includes(value.deployment.chainId) &&
    props.types.some((type) => type === value.type);
  return (
    <AddressPickerControl
      {...props}
      isInvalid={props.isInvalid || Boolean(value && !eligible)}
      selection={eligible ? <AddressIdentity value={value} compact /> : null}
      onSelect={onChange}
    />
  );
}
