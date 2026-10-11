// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useState } from "react";

import { Button } from "@namera-ai/ui";

import { EvmAddressPicker, type EvmAddressSelection } from "@/components/evm-address-picker";

const previewChains = ["eip155:1", "eip155:8453", "eip155:10", "eip155:42161"] as const;
const previewTypes = ["erc20"] as const;
const contractChains = ["eip155:1", "eip155:11155111"] as const;
const contractTypes = ["contract"] as const;

export function AddressPickerPreview() {
  const [value, setValue] = useState<EvmAddressSelection | null>(null);
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
        <EvmAddressPicker
          chainIds={previewChains}
          types={previewTypes}
          value={value}
          onChange={setValue}
          label="Search tokens"
        />
      </div>
      {value ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-muted break-all font-mono text-xs">
            {value.chainId} · {value.address}
          </p>
          <Button size="sm" variant="tertiary" onPress={() => setValue(null)}>
            Clear
          </Button>
        </div>
      ) : null}
    </section>
  );
}

export function ContractPickerPreview() {
  const [value, setValue] = useState<EvmAddressSelection | null>(null);
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
        <EvmAddressPicker
          chainIds={contractChains}
          types={contractTypes}
          value={value}
          onChange={setValue}
          label="Search contracts"
        />
      </div>
      {value ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className="text-muted break-all font-mono text-xs">
            {value.chainId} · {value.address}
          </p>
          <Button size="sm" variant="tertiary" onPress={() => setValue(null)}>
            Clear
          </Button>
        </div>
      ) : null}
    </section>
  );
}
