import { afterEach, describe, expect, it, vi } from "vitest";

import { codeToHtml } from "../../../src/lib/syntax-highlighter";

afterEach(() => vi.unstubAllGlobals());

describe("dashboard syntax highlighting", () => {
  it("highlights setup commands without WebAssembly and escapes source markup", async () => {
    vi.stubGlobal("WebAssembly", undefined);

    const html = await codeToHtml('codex mcp add namera -- namera mcp serve --profile "<script>"', {
      lang: "bash",
      defaultColor: false,
      themes: { dark: "github-dark-dimmed", light: "github-dark-dimmed" },
    });

    expect(html).toContain("--shiki-dark:");
    expect(html).toContain("--shiki-light:");
    expect(html).toMatch(/(?:&lt;|&#x3C;|&#60;)script(?:&gt;|>)/);
    expect(html).not.toContain("<script>");
    expect(html).toMatch(/<span[^>]+>codex<\/span>/);
  });
});
