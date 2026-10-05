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
});
