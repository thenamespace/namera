import { Option } from "effect";
import { HttpApiError } from "effect/http-api";
import { AsyncResult } from "effect/reactivity";

import { describe, expect, it } from "vitest";

import { queryData } from "../../../src/lib/query-data";

describe("protected query data", () => {
  const cached = { name: "Protected workspace" };
  const previousSuccess = Option.some(AsyncResult.success(cached));

  it("does not return previous data after authentication or permission rejection, including retries", () => {
    for (const error of [new HttpApiError.Unauthorized(), new HttpApiError.Forbidden()]) {
      const denied = AsyncResult.fail(error, { previousSuccess });
      expect(queryData(denied)).toBeUndefined();
      expect(queryData(AsyncResult.waiting(denied))).toBeUndefined();
    }
  });

  it("preserves loaded data during normal refreshes and temporary errors", () => {
    expect(queryData(AsyncResult.waiting(AsyncResult.success(cached)))).toBe(cached);
    for (const error of [new Error("offline"), new HttpApiError.InternalServerError()]) {
      expect(queryData(AsyncResult.fail(error, { previousSuccess }))).toBe(cached);
    }
  });

  it("handles initial loading, first-request failure and successful signed-out results", () => {
    expect(queryData(AsyncResult.initial())).toBeUndefined();
    expect(queryData(AsyncResult.fail(new Error("offline")))).toBeUndefined();
    expect(queryData(AsyncResult.success(null))).toBeNull();
  });
});
