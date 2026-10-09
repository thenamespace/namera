import { describe, expect, it } from "vitest";

import { documentSecurity } from "../../../tooling/document-security";

describe("dashboard document security", () => {
  it("allows only the API origin for connections and preserves first-party passkeys", () => {
    const { headers } = documentSecurity("https://api.example.com/base?ignored=value");
    const policy = headers["Content-Security-Policy"];

    expect(policy).toContain("connect-src 'self' https://api.example.com;");
    expect(policy).not.toContain("ignored");
    expect(policy).toContain("script-src 'self';");
    expect(policy).toContain("manifest-src 'self';");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(headers["Permissions-Policy"]).toContain("publickey-credentials-create=(self)");
    expect(headers["Permissions-Policy"]).toContain("publickey-credentials-get=(self)");
    expect(headers["Referrer-Policy"]).toBe("no-referrer");
  });

  it.each(["", "data:text/plain,hello", "https://user:password@api.example.com"])(
    "rejects an invalid API origin: %s",
    (url) => {
      expect(() => documentSecurity(url)).toThrow();
    },
  );
});
