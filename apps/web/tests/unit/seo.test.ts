import { describe, expect, it } from "vitest";

import { seo, SITE } from "../../src/lib/seo";

describe("page titles", () => {
  it("uses the plain title consistently across browser and social metadata", () => {
    const { meta } = seo({
      title: "Privacy Policy",
      description: "Privacy",
      path: "/privacy-policy",
    });
    expect(meta).toContainEqual({ title: "Privacy Policy" });
    expect(meta).toContainEqual({ property: "og:title", content: "Privacy Policy" });
    expect(meta).toContainEqual({ name: "twitter:title", content: "Privacy Policy" });
  });

  it("keeps the descriptive home page title", () => {
    expect(seo({ description: "Home", path: "/" }).meta).toContainEqual({
      title: `${SITE.name} - ${SITE.tagline}`,
    });
  });

  it("uses permission-focused copy and connected page structured data", () => {
    const head = seo({ description: SITE.description, path: "/" });
    expect(SITE.tagline).toBe("Wallets for AI agents with permissions built in");
    expect(head.meta).toContainEqual({ name: "description", content: SITE.description });
    expect(head.meta).toContainEqual({ property: "og:description", content: SITE.description });
    expect(head.meta).toContainEqual({ name: "twitter:description", content: SITE.description });
    const page = JSON.parse(head.scripts[0]?.children ?? "{}");
    expect(page["@type"]).toBe("WebPage");
    expect(page.isPartOf["@id"]).toBe(`${SITE.origin}/#website`);
    expect(page.publisher["@id"]).toBe(`${SITE.origin}/#organization`);
  });
});
