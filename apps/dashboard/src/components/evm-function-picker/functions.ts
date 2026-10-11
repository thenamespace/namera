import { toFunctionSelector, toFunctionSignature, type Abi, type AbiFunction } from "viem";

export type EvmFunctionOption = {
  readonly signature: string;
  readonly selector: `0x${string}`;
  readonly abi: AbiFunction;
};

export function abiFunctionOptions(abi: Abi): readonly EvmFunctionOption[] {
  const functions = new Map<string, EvmFunctionOption>();
  for (const entry of abi) {
    if (entry.type !== "function") continue;
    const signature = toFunctionSignature(entry);
    if (!functions.has(signature)) {
      functions.set(signature, { signature, selector: toFunctionSelector(entry), abi: entry });
    }
  }
  return [...functions.values()].toSorted((a, b) => a.signature.localeCompare(b.signature));
}

export function filterFunctions(functions: readonly EvmFunctionOption[], query: string) {
  const search = query.trim().toLowerCase();
  return functions.filter((fn) =>
    `${fn.signature} ${fn.selector} ${fn.abi.stateMutability}`.toLowerCase().includes(search),
  );
}

export function selectFunctions(
  current: readonly string[],
  additions: readonly string[],
  functions: readonly EvmFunctionOption[],
): string[] {
  const selected = new Set([...current, ...additions]);
  return functions.filter((fn) => selected.has(fn.signature)).map((fn) => fn.signature);
}
