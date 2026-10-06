import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { pageSeo, errorSeo, notFoundSeo } from "../../src/seo/pages";
import {
  dashboardSite,
  pageMetadata,
  privateRobots,
  publicRobots,
  robotsForRequest,
  resourcePageTitle,
  structuredData,
} from "../../src/seo/site";
import { documentSeoTags } from "../../tooling/document-seo";

describe("dashboard metadata", () => {
  it("uses resource names only in browser titles with a loading fallback", () => {
    expect(resourcePageTitle("Overview", "Trading Account")).toBe("Trading Account | Overview");
    expect(resourcePageTitle("Policies", "Agent key")).toBe("Agent key | Policies");
    expect(resourcePageTitle("Usage", undefined)).toBe("Usage");
    expect(resourcePageTitle("Assets", "  ")).toBe("Assets");
    expect(pageMetadata(pageSeo["/_authenticated/execution/$executionId"]).title).toBe("Execution");
  });
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
    expect(meta["og:image"]).toBe("https://cdn.namera.ai/seo/og.png");
    expect(meta["twitter:image"]).toBe(meta["og:image"]);
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

  it("shares CDN icons without duplicating assets in app public directories", () => {
    for (const publicPath of ["../../public/", "../../../web/public/"]) {
      const manifest = JSON.parse(
        readFileSync(new URL(`${publicPath}site.webmanifest`, import.meta.url), "utf8"),
      );
      expect(manifest.start_url).toBe("/");
      expect(manifest.scope).toBe("/");
      for (const icon of manifest.icons) {
        expect(icon.src).toMatch(/^https:\/\/cdn\.namera\.ai\/seo\//);
        const filename = new URL(icon.src).pathname.split("/").at(-1);
        expect(existsSync(new URL(`${publicPath}${filename}`, import.meta.url))).toBe(false);
        expect(["icon-192.png", "icon-512.png", "icon-512-maskable.png", "favicon.svg"]).toContain(
          filename,
        );
      }
      for (const filename of ["og.png", "og.svg", "favicon.ico", "apple-touch-icon.png"]) {
        expect(existsSync(new URL(`${publicPath}${filename}`, import.meta.url))).toBe(false);
      }
    }
    expect(structuredData.image).toBe("https://cdn.namera.ai/seo/og.png");
    expect(structuredData.publisher.logo).toBe("https://cdn.namera.ai/seo/icon-512.png");
  });
});
