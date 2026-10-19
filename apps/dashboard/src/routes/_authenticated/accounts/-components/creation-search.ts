import { Schema } from "effect";

const GettingStartedSource = Schema.Literal("get-started");

export function validateAccountCreationSearch(search: Record<string, unknown>): {
  from?: "get-started";
} {
  return Schema.is(GettingStartedSource)(search.from) ? { from: search.from } : {};
}
