import { Schema } from "effect";

import { describe, expect, it } from "vitest";

import {
  AddressCatalog,
  AddressCatalogEntry,
  ContractInterface,
  EvmJsonAbi,
} from "../../../src/model/index.js";

const parseOptions = { onExcessProperty: "error" } as const;
const decodeCatalog = Schema.decodeUnknownSync(AddressCatalog, parseOptions);
const decodeEntry = Schema.decodeUnknownSync(AddressCatalogEntry, parseOptions);
const decodeInterface = Schema.decodeUnknownSync(ContractInterface, parseOptions);
const decodeAbi = Schema.decodeUnknownSync(EvmJsonAbi, parseOptions);
const id = "01950000-0000-7000-8000-000000000001";
const timestamps = { createdAt: new Date(0), updatedAt: new Date(0) };
const display = { name: "Example", logo: "address-catalog/example.svg", aliases: [], tags: [] };
const catalog = {
  id,
  namespace: "eip155",
  slug: "example",
  search: ["example"],
  data: { version: 1, type: "erc20", display, details: { symbol: "EX" } },
  status: "draft",
  revision: 1,
  ...timestamps,
};
const entry = {
  id,
  catalogId: id,
  namespace: "eip155",
  chainId: "eip155:1",
  address: "0x1111111111111111111111111111111111111111",
  interfaceId: null,
  data: { version: 1, type: "erc20", decimals: 6 },
  status: "disabled",
  revision: 1,
  ...timestamps,
};
const abiFunction = {
  type: "function",
  name: "execute",
  stateMutability: "nonpayable",
  outputs: [],
  inputs: [
    {
      name: "calls",
      type: "tuple[]",
      components: [
        { name: "to", type: "address" },
        { name: "value", type: "uint256" },
        { name: "data", type: "bytes" },
      ],
    },
  ],
};

describe("address catalog schemas", () => {
  it("requires a valid logo path for tokens and contracts", () => {
    for (const type of ["erc20", "contract"]) {
      const data = { ...catalog.data, type, details: type === "erc20" ? { symbol: "EX" } : {} };
      for (const logo of [
        undefined,
        null,
        "",
        "https://cdn.namera.ai/example.svg",
        "../example.svg",
        "address-catalog/../example.svg",
        "address-catalog/eip155/../../example.svg",
        "address-catalog//example.svg",
        "address-catalog/eip155/%2e%2e/example.svg",
        "address-catalog/example.svg?redirect=elsewhere",
        "address-catalog/example.svg#fragment",
        "address-catalog/eip155\\example.svg",
      ]) {
        expect(() =>
          decodeCatalog({ ...catalog, data: { ...data, display: { ...display, logo } } }),
        ).toThrow();
      }
      for (const extension of ["svg", "png", "webp"]) {
        for (const directory of ["", "eip155/", "eip155/erc20/"]) {
          const logo = `address-catalog/${directory}example.${extension}`;
          expect(
            decodeCatalog({ ...catalog, data: { ...data, display: { ...display, logo } } }).data
              .display.logo,
          ).toBe(logo);
        }
      }
    }
  });

  it("decodes both variants and round-trips deployment evidence without ABI duplication", () => {
    expect(decodeCatalog(catalog).data.type).toBe("erc20");
    expect(
      decodeCatalog({
        ...catalog,
        data: {
          version: 1,
          type: "contract",
          display,
          details: { protocol: "Example", contractVersion: "1" },
        },
      }).data.type,
    ).toBe("contract");
    const input = {
      ...entry,
      interfaceId: id,
      data: {
        ...entry.data,
        verification: {
          sourceUrl: "https://example.test/deployment",
          checkedAt: "2026-10-11T00:00:00.000Z",
          implementationAddress: entry.address,
        },
      },
    };
    expect(Schema.encodeSync(AddressCatalogEntry)(decodeEntry(input))).toEqual(input);
    expect(
      decodeEntry({ ...entry, data: { version: 1, type: "contract" } }).interfaceId,
    ).toBeNull();
  });

  it("rejects unsupported namespaces, variants, versions and invalid deployment units", () => {
    for (const change of [
      { namespace: "solana" },
      { data: { ...catalog.data, type: "erc721" } },
      { data: { ...catalog.data, version: 2 } },
      { revision: 0 },
    ]) {
      expect(() => decodeCatalog({ ...catalog, ...change })).toThrow();
    }
    for (const change of [
      { chainId: "eip155:137" },
      { interfaceId: "invalid" },
      { address: "0x123" },
      ...[-1, 256, 1.5].map((decimals) => ({ data: { ...entry.data, decimals } })),
      { data: { version: 1, type: "erc20" } },
      { data: { version: 1, type: "contract", decimals: 18 } },
      { data: { ...entry.data, abiOverride: [] } },
    ]) {
      expect(() => decodeEntry({ ...entry, ...change })).toThrow();
    }
    expect(() => decodeCatalog({ ...catalog, data: { ...catalog.data, abi: [] } })).toThrow();
  });

  it("accepts modern JSON ABI item kinds and preserves tuple/event information", () => {
    const document = [
      abiFunction,
      { type: "constructor", inputs: [], stateMutability: "nonpayable" },
      {
        type: "event",
        name: "Sent",
        inputs: [{ name: "to", type: "address", indexed: true }],
        anonymous: false,
      },
      { type: "error", name: "Denied", inputs: [] },
      { type: "fallback", stateMutability: "nonpayable" },
      { type: "receive", stateMutability: "payable" },
    ];
    expect(decodeAbi(document)).toEqual(document);
    const artifact = {
      id,
      format: "evm-abi",
      document,
      contentHash: "a".repeat(64),
      sourceUrl: "https://example.test/abi.json",
      createdAt: new Date(0),
    };
    expect(Schema.encodeSync(ContractInterface)(decodeInterface(artifact))).toEqual(artifact);
    expect(() => decodeInterface({ ...artifact, format: "anchor-idl" })).toThrow();
    expect(() => decodeInterface({ ...artifact, contentHash: "bad" })).toThrow();
    expect(() =>
      decodeInterface({ ...artifact, sourceUrl: "https://user:secret@example.test" }),
    ).toThrow();
  });

  it("rejects malformed types, incomplete tuples, wrong mutability and excessive nesting", () => {
    for (const parameter of [
      { name: "x", type: "uint7" },
      { name: "x", type: "bytes33" },
      { name: "x", type: "tuple[]" },
      { name: "x", type: "address", components: [] },
      { name: "x", type: "uint256[0]" },
    ])
      expect(() => decodeAbi([{ ...abiFunction, inputs: [parameter] }])).toThrow();
    expect(() => decodeAbi([{ type: "receive", stateMutability: "view" }])).toThrow();
    expect(() =>
      decodeAbi([
        { type: "event", name: "X", inputs: [{ name: "x", type: "address" }], anonymous: false },
      ]),
    ).toThrow();
    expect(() => decodeAbi({})).toThrow();
    expect(() => decodeAbi(Array.from({ length: 2049 }, () => abiFunction))).toThrow();
    let parameter: { name: string; type: string; components?: readonly unknown[] } = {
      name: "x",
      type: "address",
    };
    for (let i = 0; i < 10; i++) parameter = { name: "x", type: "tuple", components: [parameter] };
    expect(() => decodeAbi([{ ...abiFunction, inputs: [parameter] }])).toThrow();
  });
});
