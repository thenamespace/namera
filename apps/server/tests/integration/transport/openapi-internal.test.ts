import { describe, expect, it } from "@effect/vitest";
import { OpenApi } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";

// /internal is the operator surface: reachable with ADMIN_TOKEN, but never
// advertised in the published spec or the Scalar reference. A new admin group
// that forgets `OpenApi.Exclude` fails here rather than in production.
describe("published OpenAPI specification", () => {
  it("documents no internal route", () => {
    const spec = OpenApi.fromApi(NameraApi) as { paths: Record<string, unknown> };
    const leaked = Object.keys(spec.paths).filter((path) => path.startsWith("/internal"));
    expect(leaked).toEqual([]);
  });

  it("still documents the public surface", () => {
    const spec = OpenApi.fromApi(NameraApi) as { paths: Record<string, unknown> };
    expect(Object.keys(spec.paths)).toContain("/waitlist");
  });
});
