import { describe, expect, it } from "@effect/vitest";
import { OpenApi } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";

// /internal is the platform-member surface, but never
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

  it("exposes detached execution and signing without the retired synchronous endpoints", () => {
    const spec = OpenApi.fromApi(NameraApi) as {
      paths: Record<string, Record<string, unknown>>;
    };
    for (const resource of ["executions", "signatures"]) {
      expect(spec.paths[`/${resource}`]?.post).toBeUndefined();
      expect(spec.paths[`/${resource}/`]?.post).toBeUndefined();
      expect(spec.paths[`/${resource}/prepare`]?.post).toBeDefined();
      expect(spec.paths[`/${resource}/complete`]?.post).toBeDefined();
    }
    expect(spec.paths["/executions/"]?.get ?? spec.paths["/executions"]?.get).toBeDefined();
  });
});
