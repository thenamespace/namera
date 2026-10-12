// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-jsx-as-prop
import { useState } from "react";

import { AddressPickerControl } from "./evm-address-picker/control";
import { AddressIdentity } from "./evm-address-picker/identity";
import type {
  EvmAddressPickerWithCustomProps,
  EvmCatalogType,
  EvmCustomAddress,
} from "./evm-address-picker/types";
export type {
  EvmAddressPickerWithCustomProps,
  CustomAddressRenderProps,
} from "./evm-address-picker/types";

export function EvmAddressPickerWithCustom<
  const T extends EvmCatalogType,
  C extends EvmCustomAddress,
>({
  value,
  onChange,
  renderCustom,
  renderCustomValue,
  ...props
}: EvmAddressPickerWithCustomProps<T, C>) {
  const [customError, setCustomError] = useState<string | null>(null);
  const address = value?.source === "catalog" ? value.deployment : value?.value;
  const eligible =
    address &&
    props.chainIds.includes(address.chainId) &&
    (value?.source !== "catalog" || props.types.some((type) => type === value.type));
  return (
    <AddressPickerControl
      {...props}
      isInvalid={props.isInvalid || Boolean(value && !eligible)}
      selection={
        eligible && value ? (
          value.source === "catalog" ? (
            <AddressIdentity value={value} compact />
          ) : (
            renderCustomValue(value.value)
          )
        ) : null
      }
      onSelect={onChange}
      renderCustom={(initialAddress, close, back) => (
        <>
          {renderCustom({
            initialValue: value?.source === "custom" ? value.value : null,
            initialAddress,
            chainIds: props.chainIds,
            onCancel: () => {
              setCustomError(null);
              back();
            },
            onConfirm: (custom) => {
              if (!props.chainIds.includes(custom.chainId)) {
                setCustomError("Choose an allowed network.");
                return;
              }
              setCustomError(null);
              onChange({ source: "custom", value: custom });
              close();
            },
          })}
          {customError ? (
            <p role="alert" className="text-danger px-4 pb-4 text-sm">
              {customError}
            </p>
          ) : null}
        </>
      )}
    />
  );
}
