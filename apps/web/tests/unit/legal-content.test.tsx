import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { legalMdxComponents } from "../../src/components/legal/mdx-components";
import PrivacyPolicy, { toc as privacyToc } from "../../src/content/legal/privacy-policy.mdx";
import Terms, { toc as termsToc } from "../../src/content/legal/terms.mdx";

describe("legal content", () => {
  for (const { name, Content, toc } of [
    { name: "terms", Content: Terms, toc: termsToc },
    { name: "privacy policy", Content: PrivacyPolicy, toc: privacyToc },
  ]) {
    it(`renders ${name} with working section anchors and semantic lists`, () => {
      const html = renderToStaticMarkup(<Content components={legalMdxComponents} />);

      expect(toc.length).toBeGreaterThan(0);
      expect(new Set(toc.map((entry) => entry.url)).size).toBe(toc.length);
      for (const entry of toc) {
        expect(html).toContain(`id="${entry.url.slice(1)}"`);
      }
      expect(html).toContain("<h2");
      expect(html).toContain("<ul");
      expect(html).toContain("<li");
      expect(html).toContain('href="mailto:hey@namera.ai"');
      expect(html).not.toContain("—");
      expect(html).not.toMatch(/this draft|proposed agreement|must be confirmed before/i);
      expect(html).toContain("British Virgin Islands VG1110");
    });
  }

  it("links the terms to the local privacy policy", () => {
    const html = renderToStaticMarkup(<Terms components={legalMdxComponents} />);
    expect(html).toContain('href="/privacy-policy"');
  });
});
