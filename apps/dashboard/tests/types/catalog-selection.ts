import type { CatalogEntryView } from "@namera-ai/protocol/dto";
import { expectTypeOf } from "vitest";

import { catalogSelection } from "../../src/components/evm-address-picker/selection";
import type { EvmAddressSelection } from "../../src/components/evm-address-picker/types";

declare const match: typeof CatalogEntryView.Type;

const token = catalogSelection(match, ["erc20"]);
expectTypeOf(token).toEqualTypeOf<EvmAddressSelection<"erc20"> | null>();

const mixed = catalogSelection(match, ["erc20", "contract"]);
if (mixed?.type === "erc20") {
  expectTypeOf(mixed.catalog.data.type).toEqualTypeOf<"erc20">();
  expectTypeOf(mixed.deployment.data.decimals).toEqualTypeOf<number>();
} else if (mixed?.type === "contract") {
  expectTypeOf(mixed.catalog.data.type).toEqualTypeOf<"contract">();
  expectTypeOf(mixed.deployment.data.type).toEqualTypeOf<"contract">();
}
