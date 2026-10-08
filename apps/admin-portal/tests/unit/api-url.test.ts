import { describe, expect, it } from "vitest";

import { resolveApiUrl } from "../../src/api-url";
import { documentSecurity } from "../../tooling/document-security";

describe("admin API URL", () => {
  it.each([undefined, "", "   "])("defaults missing or blank configuration: %s", (value) => {
    const url = resolveApiUrl(value);
    expect(url).toBe("https://api.namera.ai");
    expect(documentSecurity(url).headers["Content-Security-Policy"]).toContain(
      "connect-src 'self' https://api.namera.ai;",
    );
  });

  it("preserves an explicit local endpoint", () => {
    const url = resolveApiUrl(" http://localhost:8080 ");
    expect(url).toBe("http://localhost:8080");
    expect(documentSecurity(url).headers["Content-Security-Policy"]).toContain(
      "connect-src 'self' http://localhost:8080;",
    );
  });

  it.each(["not-a-url", "data:text/plain,hello", "https://user:password@api.example.com"])(
    "does not hide invalid explicit configuration: %s",
    (value) => expect(() => documentSecurity(resolveApiUrl(value))).toThrow(),
  );
});
