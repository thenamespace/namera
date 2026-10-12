import type { CatalogEntryView } from "@namera-ai/protocol/dto";
import { formatUnits } from "viem";

export function tokenDisplayDetails(
  match: typeof CatalogEntryView.Type | null | undefined,
  amount?: string,
) {
  if (match?.catalog.data.type !== "erc20" || match.entry.data.type !== "erc20") return null;
  const { display, details } = match.catalog.data;
  return {
    display,
    symbol: details.symbol,
    label:
      amount === undefined
        ? display.name
        : `${formatUnits(BigInt(amount), match.entry.data.decimals)} ${details.symbol}`,
  };
}
