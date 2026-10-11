import { describe, expect, it } from "vitest";

import { readCatalogFile } from "../../src/routes/_authenticated/-components/catalog/import-form";

const upload = { version: 1, catalog: [], entries: [], interfaces: [] };

describe("catalog file validation", () => {
  it("reads a valid JSON upload without changing its shape", async () => {
    expect(await readCatalogFile(new File([JSON.stringify(upload)], "catalog.json"))).toEqual(
      upload,
    );
  });
  it("rejects empty, oversized, malformed and unsupported uploads", async () => {
    await Promise.all(
      [
        "",
        "x".repeat(2 * 1024 * 1024 + 1),
        "not json",
        JSON.stringify({ ...upload, version: 2 }),
        JSON.stringify({ ...upload, extra: true }),
      ].map((content) =>
        expect(readCatalogFile(new File([content], "catalog.json"))).rejects.toBeDefined(),
      ),
    );
  });
  it("requires logos and rejects unknown nested fields before sending the file", async () => {
    const catalog = {
      id: "01900000-0000-7000-8000-000000000001",
      namespace: "eip155",
      slug: "token",
      search: ["Token"],
      status: "draft",
      data: {
        version: 1,
        type: "erc20",
        display: { name: "Token", aliases: [], tags: [] },
        details: { symbol: "T" },
      },
    };
    await expect(
      readCatalogFile(
        new File([JSON.stringify({ ...upload, catalog: [catalog] })], "catalog.json"),
      ),
    ).rejects.toBeDefined();
    const valid = {
      ...catalog,
      data: {
        ...catalog.data,
        display: { ...catalog.data.display, logo: "address-catalog/token.svg" },
      },
    };
    const result = await readCatalogFile(
      new File([JSON.stringify({ ...upload, catalog: [valid] })], "catalog.json"),
    );
    expect(result.catalog[0]?.data.display.logo).toBe("address-catalog/token.svg");
    await expect(
      readCatalogFile(
        new File(
          [
            JSON.stringify({
              ...upload,
              catalog: [{ ...valid, data: { ...valid.data, abi: [] } }],
            }),
          ],
          "catalog.json",
        ),
      ),
    ).rejects.toBeDefined();
  });
});
