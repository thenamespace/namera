import { afterEach, beforeEach, expect, vi } from "vitest";

import "../../src/styles.css";

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    throw new Error(`Unexpected browser request: ${String(input)}`);
  });
});

afterEach(() => {
  try {
    expect(globalThis.fetch).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});
