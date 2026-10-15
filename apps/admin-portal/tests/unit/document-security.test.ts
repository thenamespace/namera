import { describe, expect, it } from "vitest";

import { documentSecurity } from "../../tooling/document-security";

describe("operator document security", () => {
  it("limits API access to its origin and prevents indexing, framing and referrer leakage", () => {
    const { headers } = documentSecurity("https://api.example.com/base?ignored=value");
    expect(headers["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://api.example.com;",
    );
    expect(headers["Content-Security-Policy"]).not.toContain("ignored");
    expect(headers["Content-Security-Policy"]).toContain("script-src 'self';");
    expect(headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(headers["X-Robots-Tag"]).toBe("noindex, nofollow");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });

  it.each(["data:text/plain,hello", "https://user:password@api.example.com"])(
    "rejects unsafe API origin %s",
    (origin) => {
      expect(() => documentSecurity(origin)).toThrow("HTTP(S) URL without credentials");
    },
  );
});
