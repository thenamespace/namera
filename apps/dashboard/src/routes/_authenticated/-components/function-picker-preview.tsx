import { useState } from "react";

import { erc721Abi } from "viem";

import { EvmFunctionPicker } from "@/components/evm-function-picker";

export function FunctionPickerPreview() {
  const [single, setSingle] = useState<string | null>(null);
  const [multiple, setMultiple] = useState<readonly string[]>([]);
  return (
    <section
      className="border-separator mb-6 rounded-xl border p-5"
      aria-labelledby="function-picker-preview"
    >
      <h2 id="function-picker-preview" className="text-sm font-medium">
        Function picker preview
      </h2>
      <p className="text-muted mt-1 text-sm">
        Standard ERC-721 ABI, including overloaded transfers. Selections are local and don’t save a
        policy.
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-2 text-sm">Single function</p>
          <EvmFunctionPicker
            abi={erc721Abi}
            selectionMode="single"
            value={single}
            onChange={setSingle}
            label="Select a function"
          />
        </div>
        <div className="min-w-0">
          <p className="mb-2 text-sm">Multiple functions</p>
          <EvmFunctionPicker
            abi={erc721Abi}
            selectionMode="multiple"
            value={multiple}
            onChange={setMultiple}
            label="Select multiple functions"
          />
        </div>
      </div>
      {single || multiple.length ? (
        <div className="text-muted mt-4 grid gap-2 break-all font-mono text-xs" aria-live="polite">
          {single ? <p>Single: {single}</p> : null}
          {multiple.length ? <p>Multiple: {multiple.join(", ")}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
