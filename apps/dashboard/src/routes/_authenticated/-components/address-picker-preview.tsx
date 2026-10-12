// oxlint-disable react-perf/jsx-no-new-function-as-prop, react-perf/jsx-no-new-object-as-prop
import { useState } from "react";

import { Button } from "@namera-ai/ui";

import {
  EvmAddressPicker,
  type EvmAddressSelection,
  type EvmAddressValue,
  type EvmCustomAddress,
} from "@/components/evm-address-picker";
import {
  EvmAddressPickerWithCustom,
  type CustomAddressRenderProps,
} from "@/components/evm-address-picker-with-custom";
import { CustomAddress } from "@/components/evm-address-picker/custom-address";
import { AddressIdentity } from "@/components/evm-address-picker/identity";
import { EvmContractPicker, type EvmContractSelection } from "@/components/evm-contract-picker";
import { EvmErc20Picker, type EvmErc20Selection } from "@/components/evm-erc20-picker";

const previewChains = ["eip155:1", "eip155:8453", "eip155:10", "eip155:42161"] as const;
const previewTypes = ["erc20", "contract"] as const;
const contractChains = ["eip155:1", "eip155:11155111"] as const;
const renderCustom = (props: CustomAddressRenderProps<EvmCustomAddress>) => (
  <CustomAddress {...props} mode="contract" />
);
const renderCustomValue = (value: EvmCustomAddress) => (
  <AddressIdentity value={{ source: "custom", value }} compact />
);

export function AddressPickerPreview() {
  const [value, setValue] = useState<EvmErc20Selection | null>(null);
  const [catalog, setCatalog] = useState<EvmAddressSelection | null>(null);
  const [generic, setGeneric] = useState<EvmAddressValue<
    "erc20" | "contract",
    EvmCustomAddress
  > | null>(null);
  const address = value?.source === "catalog" ? value.deployment : value?.value;
  const decimals =
    value?.source === "catalog" ? value.deployment.data.decimals : value?.value.decimals;
  return (
    <section
      className="border-separator mb-6 rounded-xl border p-5"
      aria-labelledby="address-picker-preview"
    >
      <div className="mb-4">
        <h2 id="address-picker-preview" className="text-sm font-medium">
          Token picker preview
        </h2>
        <p className="text-muted mt-1 text-sm">
          Find a token on Ethereum, Base, Optimism, or Arbitrum. This preview doesn’t save a policy.
        </p>
      </div>
      <div className="max-w-lg">
        <EvmErc20Picker
          chainIds={previewChains}
          value={value}
          onChange={setValue}
          label="Search tokens"
        />
      </div>
      {value ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-muted break-all font-mono text-xs">
            {address?.chainId} · {address?.address} · {decimals} decimals
          </p>
          <Button size="sm" variant="tertiary" onPress={() => setValue(null)}>
            Clear
          </Button>
        </div>
      ) : null}
      <div className="mt-6 max-w-lg">
        <h3 className="mb-2 text-sm font-medium">Catalog-only picker</h3>
        <EvmAddressPicker
          chainIds={previewChains}
          types={previewTypes}
          value={catalog}
          onChange={setCatalog}
          label="Select from catalog"
        />
        {catalog ? (
          <p className="text-muted mt-2 text-xs">
            {catalog.type} · {catalog.catalog.data.display.name} · {catalog.deployment.chainId}
          </p>
        ) : null}
      </div>
      <div className="mt-6 max-w-lg">
        <h3 className="mb-2 text-sm font-medium">Catalog + custom address picker</h3>
        <EvmAddressPickerWithCustom
          chainIds={previewChains}
          types={previewTypes}
          value={generic}
          onChange={setGeneric}
          renderCustom={renderCustom}
          renderCustomValue={renderCustomValue}
          label="Select token, contract, or custom address"
        />
      </div>
    </section>
  );
}

export function ContractPickerPreview() {
  const [value, setValue] = useState<EvmContractSelection | null>(null);
  const address = value?.source === "catalog" ? value.deployment : value?.value;
  return (
    <section
      className="border-separator mb-6 rounded-xl border p-5"
      aria-labelledby="contract-picker-preview"
    >
      <div className="mb-4">
        <h2 id="contract-picker-preview" className="text-sm font-medium">
          Contract picker preview
        </h2>
        <p className="text-muted mt-1 text-sm">
          Find a contract on Ethereum or Sepolia. Catalog tokens are excluded; custom addresses
          remain unverified. This preview doesn’t save a policy.
        </p>
      </div>
      <div className="max-w-lg">
        <EvmContractPicker
          chainIds={contractChains}
          value={value}
          onChange={setValue}
          label="Search contracts"
        />
      </div>
      {value ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-muted break-all font-mono text-xs">
            {address?.chainId} · {address?.address}
          </p>
          <Button size="sm" variant="tertiary" onPress={() => setValue(null)}>
            Clear
          </Button>
        </div>
      ) : null}
    </section>
  );
}
