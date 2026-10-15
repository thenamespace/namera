import { afterEach, beforeEach, expect, vi } from "vitest";

import "../../src/styles.css";

export const unexpectedRequests: string[] = [];

beforeEach(() => {
  unexpectedRequests.length = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    unexpectedRequests.push(String(input));
    throw new Error(`Unexpected browser request: ${String(input)}`);
  });
});

afterEach(() => {
  try {
    expect(unexpectedRequests).toEqual([]);
  } finally {
    vi.restoreAllMocks();
  }
});
