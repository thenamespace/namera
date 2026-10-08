import { expect, it } from "vitest";

import { formatFeedback } from "../../../src/services/output/feedback.js";

it("sanitizes untrusted terminal text before adding its own styling", () => {
  expect(
    formatFeedback("oops\u001b[2J", "next\nline", "warning", { colors: false, unicode: false }),
  ).toBe("! oops\n-> next line");
});
