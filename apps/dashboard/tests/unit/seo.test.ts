import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { pageSeo, errorSeo, notFoundSeo } from "../../src/seo/pages";
import {
  dashboardSite,
  pageMetadata,
  privateRobots,
  publicRobots,
  robotsForRequest,
  structuredData,
} from "../../src/seo/site";
import { documentSeoTags } from "../../tooling/document-seo";

describe("dashboard metadata", () => {
  it("keeps settings titles free of a settings suffix", () => {
    for (const [routeId, page] of Object.entries(pageSeo)) {
      if (routeId.includes("/settings/")) expect(page.title).not.toMatch(/ settings$/i);
    }
  });

  it.each(Object.entries(pageSeo))("provides complete metadata for %s", (_routeId, page) => {
    const { title, meta } = pageMetadata(page);
    expect(title).toBe(page.title);
    expect(title).not.toMatch(/\| Namera$/);
    expect(page.description.length).toBeGreaterThan(30);
    expect(meta["og:title"]).toBe(title);
    expect(meta["twitter:title"]).toBe(title);
    expect(meta["og:description"]).toBe(page.description);
    expect(meta["twitter:description"]).toBe(page.description);
    expect(meta["og:image"]).toBe("https://dashboard.namera.ai/og.png");
    expect(meta["og:url"]).toBe("https://dashboard.namera.ai/auth");
  });

  it("indexes only the public sign-in routes", () => {
    for (const [routeId, page] of Object.entries(pageSeo)) {
      expect(pageMetadata(page).meta.robots).toBe(
        ["/auth", "/auth/"].includes(routeId) ? publicRobots : privateRobots,
      );
    }
    expect(pageMetadata(errorSeo).meta.robots).toBe(privateRobots);
    expect(pageMetadata(notFoundSeo).meta.robots).toBe(privateRobots);
  });

  it.each([
    "/",
    "/accounts",
    "/auth/verify?token=secret",
    "/auth?invite=secret",
    "/oauth/authorize?requestId=secret",
    "/session-key/private-id/overview",
    "/unknown",
  ])("prevents indexing at the HTTP boundary for %s", (path) => {
    expect(robotsForRequest(path)).toBe(privateRobots);
  });
  it.each(["/auth", "/auth/"])("allows the public entry %s", (path) => {
    expect(robotsForRequest(path)).toBe(publicRobots);
  });

  it("uses public application structured data without fabricated ratings or offers", () => {
    expect(structuredData["@type"]).toBe("WebApplication");
    expect(structuredData.url).toBe(`${dashboardSite.origin}/auth`);
    expect(structuredData).not.toHaveProperty("aggregateRating");
    expect(structuredData).not.toHaveProperty("offers");
  });

  it("injects one set of metadata into the static HTML for non-JS crawlers", () => {
    const tags = documentSeoTags();
    expect(tags.filter((tag) => tag.tag === "title")).toHaveLength(1);
    const metas = tags.filter((tag) => tag.tag === "meta");
    expect(new Set(metas.map((tag) => tag.attrs?.["data-dashboard-seo"])).size).toBe(metas.length);
    expect(tags.find((tag) => tag.tag === "link")?.attrs?.href).toBe(
      `${dashboardSite.origin}/auth`,
    );
    expect(
      JSON.parse(String(tags.find((tag) => tag.tag === "script")?.children ?? "null")),
    ).toEqual(structuredData);
  });

  it("ships app icons and a correctly sized social image", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../../public/site.webmanifest", import.meta.url), "utf8"),
    );
    expect(manifest.start_url).toBe("/");
    expect(manifest.scope).toBe("/");
    for (const icon of manifest.icons) {
      const png = readFileSync(new URL(`../../public${icon.src}`, import.meta.url));
      expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(icon.sizes);
    }
    const image = readFileSync(new URL("../../public/og.png", import.meta.url));
    expect(image.readUInt32BE(16)).toBe(1200);
    expect(image.readUInt32BE(20)).toBe(630);
  });
});
