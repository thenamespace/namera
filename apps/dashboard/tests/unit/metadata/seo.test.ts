import { describe, expect, it } from "vitest";

import { pageSeo, errorSeo, notFoundSeo } from "../../../src/seo/pages";
import {
  dashboardSite,
  pageMetadata,
  privateRobots,
  publicRobots,
  robotsForRequest,
  resourcePageTitle,
  structuredData,
} from "../../../src/seo/site";
import { documentSeoTags } from "../../../tooling/document-seo";

describe("dashboard metadata", () => {
  it("uses resource names only in browser titles with a loading fallback", () => {
    expect(resourcePageTitle("Overview", "Trading Account")).toBe("Trading Account | Overview");
    expect(resourcePageTitle("Policies", "Agent key")).toBe("Agent key | Policies");
    expect(resourcePageTitle("Usage", undefined)).toBe("Usage");
    expect(resourcePageTitle("Assets", "  ")).toBe("Assets");
    expect(pageMetadata(pageSeo["/_authenticated/execution/$executionId"]).title).toBe("Execution");
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
});
