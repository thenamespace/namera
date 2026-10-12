import { Schema } from "effect";

import { CatalogEntryView } from "@namera-ai/protocol/dto";
import { describe, expect, expectTypeOf, it } from "vitest";

import { tokenDisplayDetails } from "../../src/components/display/token-details";
import { catalogSelection } from "../../src/components/evm-address-picker/selection";
import type { EvmAddressSelection } from "../../src/components/evm-address-picker/types";

const match = Schema.decodeUnknownSync(CatalogEntryView)({
  catalog: {
    id: "01a12c3d-2311-76dc-921e-580b48f2987d",
    namespace: "eip155",
    slug: "example",
    search: ["example"],
    data: {
      version: 1,
      type: "erc20",
      display: { name: "Example", logo: "address-catalog/example.svg", aliases: [], tags: [] },
      details: { symbol: "EXAMPLE" },
    },
    status: "published",
    revision: 1,
    createdAt: new Date("2026-10-12T00:00:00Z"),
    updatedAt: new Date("2026-10-12T00:00:00Z"),
  },
  entry: {
    id: "01a12c3d-2312-77d1-8ee8-718d9305bae1",
    catalogId: "01a12c3d-2311-76dc-921e-580b48f2987d",
    namespace: "eip155",
    chainId: "eip155:1",
    address: "0x0000000000000000000000000000000000000001",
    interfaceId: null,
    data: { version: 1, type: "erc20", decimals: 6 },
    status: "active",
    revision: 1,
    createdAt: new Date("2026-10-12T00:00:00Z"),
    updatedAt: new Date("2026-10-12T00:00:00Z"),
  },
});

describe("catalog picker selections", () => {
  it("formats token allowances exactly with deployment decimals", () => {
    expect(tokenDisplayDetails(match, "100000000")?.label).toBe("100 EXAMPLE");
    expect(tokenDisplayDetails(match, "9007199254740993123456")?.label).toBe(
      "9007199254740993.123456 EXAMPLE",
    );
    expect(tokenDisplayDetails(match, "0")?.label).toBe("0 EXAMPLE");
    expect(tokenDisplayDetails(match)?.label).toBe("Example");
  });
  it("does not infer token decimals for unknown or contract deployments", () => {
    expect(tokenDisplayDetails(null, "100000000")).toBeNull();
    expect(
      tokenDisplayDetails(
        { ...match, entry: { ...match.entry, data: { version: 1, type: "contract" } } },
        "100000000",
      ),
    ).toBeNull();
  });
  it("retains the full records and narrows decimals for ERC-20", () => {
    const selection = catalogSelection(match, ["erc20"]);
    expectTypeOf(selection).toEqualTypeOf<EvmAddressSelection<"erc20"> | null>();
    expect(selection?.deployment.data.decimals).toBe(6);
    expect(selection?.catalog).toBe(match.catalog);
    expect(selection?.deployment).toBe(match.entry);
  });
  it("excludes types outside the picker scope", () => {
    expect(catalogSelection(match, ["contract"])).toBeNull();
    expect(catalogSelection(match, [])).toBeNull();
  });
  it("rejects mismatched deployment types and parents", () => {
    expect(
      catalogSelection(
        { ...match, entry: { ...match.entry, data: { version: 1, type: "contract" } } },
        ["erc20", "contract"],
      ),
    ).toBeNull();
    expect(
      catalogSelection(
        {
          ...match,
          entry: {
            ...match.entry,
            catalogId: Schema.decodeUnknownSync(CatalogEntryView.fields.entry.fields.catalogId)(
              "01a12c3d-2311-76dc-921e-580b48f2987e",
            ),
          },
        },
        ["erc20"],
      ),
    ).toBeNull();
  });
  it("narrows a mixed selection using the outer discriminator", () => {
    const selection = catalogSelection(match, ["erc20", "contract"]);
    if (selection?.type === "erc20") {
      expectTypeOf(selection.catalog.data.type).toEqualTypeOf<"erc20">();
      expectTypeOf(selection.deployment.data.decimals).toEqualTypeOf<number>();
      expect(selection.catalog.data.details.symbol).toBe("EXAMPLE");
    } else throw new Error("Expected ERC-20 selection");
  });
});
