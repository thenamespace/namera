import { describe, expect, it } from "vitest";

import { cliFailure, formatFailure } from "../../src/services/error-feedback.js";
import { feedbackStyle, formatFeedback } from "../../src/services/output/feedback.js";

const tty = { isTTY: true, hasColors: () => true };

describe("terminal feedback", () => {
  it("uses red errors and blue next steps without labels or codes", () => {
    const text = formatFailure(cliFailure("INVALID_EXPORT"), false, {
      colors: true,
      unicode: true,
    });
    expect(text).toContain("\u001b[31m✖ The encrypted");
    expect(text).toContain("\u001b[34m→ Copy the entire");
    expect(text).not.toMatch(/Error:|Next:|Code:|INVALID_EXPORT/);
    expect(text.split("\n")).toHaveLength(2);
  });
  it("renders warnings in yellow without changing failure metadata", () => {
    const failure = cliFailure("ALREADY_IMPORTED");
    expect(formatFailure(failure, false, { colors: true, unicode: true })).toContain("\u001b[33m⚠");
    expect(
      JSON.parse(formatFailure(failure, true, { colors: true, unicode: true })).error.code,
    ).toBe("ALREADY_IMPORTED");
    expect(formatFailure(failure, true, { colors: true, unicode: true })).not.toContain("\u001b");
  });
  it("uses ASCII without ANSI for pipes and dumb terminals", () => {
    for (const style of [
      feedbackStyle({ isTTY: false }, {}, "darwin"),
      feedbackStyle(tty, { TERM: "dumb" }, "linux"),
    ]) {
      expect(style).toEqual({ colors: false, unicode: false });
      expect(formatFeedback("Failed.", "Check settings.", "error", style)).toBe(
        "x Failed.\n-> Check settings.",
      );
    }
  });
  it("honors color opt-outs and the actual stderr capabilities", () => {
    expect(feedbackStyle(tty, { NO_COLOR: "" }, "darwin").colors).toBe(false);
    expect(feedbackStyle(tty, { FORCE_COLOR: "0" }, "linux").colors).toBe(false);
    expect(feedbackStyle({ isTTY: true, hasColors: () => false }, {}, "linux").colors).toBe(false);
    expect(feedbackStyle(tty, { TERM: "xterm-256color" }, "darwin").colors).toBe(true);
  });
  it("uses Unicode on modern Windows terminals and ASCII on legacy consoles/locales", () => {
    expect(feedbackStyle(tty, { WT_SESSION: "test" }, "win32").unicode).toBe(true);
    expect(feedbackStyle(tty, { TERM_PROGRAM: "vscode" }, "win32").unicode).toBe(true);
    expect(feedbackStyle(tty, {}, "win32").unicode).toBe(false);
    expect(feedbackStyle(tty, { LC_ALL: "C", LANG: "en_US.UTF-8" }, "linux").unicode).toBe(false);
  });
  it("sanitizes text before adding its own terminal styling", () => {
    expect(
      formatFeedback("oops\u001b[2J", "next\nline", "warning", { colors: false, unicode: false }),
    ).toBe("! oops\n-> next line");
  });
});
