import { describe, expect, it } from "vitest";

import { getDocsSection } from "../../src/lib/docs/sections";
import { docsHead } from "../../src/lib/docs/seo";
import { jsonLd, seo, SITE } from "../../src/lib/seo";

describe("public page metadata", () => {
  it("classifies template guides as SDK documentation", () => {
    expect(getDocsSection("/docs/sdk/guides/templates/usdc-allowance")).toBe("sdk");
    const head = docsHead({
      title: "USDC Spend Template",
      url: "/docs/sdk/guides/templates/usdc-allowance",
    });
    expect(head.scripts.map((script) => JSON.parse(script.children))).toContainEqual(
      expect.objectContaining({ "@type": "TechArticle", articleSection: "SDK" }),
    );
  });
  it("escapes script termination without changing structured data", () => {
    const content = { name: '</script><script>alert("example")</script>' };
    const script = jsonLd(content);
    expect(script.children).not.toContain("<");
    expect(JSON.parse(script.children)).toEqual(content);
    expect(script.type).toBe("application/ld+json");
  });

  it("keeps canonical, social URLs and structured data on the configured origin", () => {
    const head = seo({
      title: "Example",
      description: "Example page",
      path: "/docs/sdk",
      image: "/cover.png",
      noindex: true,
    });
    expect(head.links).toContainEqual({ rel: "canonical", href: `${SITE.origin}/docs/sdk` });
    expect(head.meta).toContainEqual({ property: "og:url", content: `${SITE.origin}/docs/sdk` });
    expect(head.meta).toContainEqual({
      name: "twitter:image",
      content: `${SITE.origin}/cover.png`,
    });
    expect(head.meta).toContainEqual({ name: "robots", content: "noindex, follow" });
    const script = head.scripts[0];
    if (!script) throw new Error("Missing page structured data");
    expect(JSON.parse(script.children)).toMatchObject({
      url: `${SITE.origin}/docs/sdk`,
      primaryImageOfPage: { url: `${SITE.origin}/cover.png` },
    });
  });
});
