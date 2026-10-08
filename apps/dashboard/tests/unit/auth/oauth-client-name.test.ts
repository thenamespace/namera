import { describe, expect, it } from "vitest";

import { getOAuthClientName } from "../../../src/components/display/oauth-client-name.js";

describe("OAuth client display names", () => {
  it.each([
    ["Namera local MCP: codex", "Codex"],
    ["Namera local MCP: claude", "Claude Code"],
    ["codex", "Codex"],
    ["Claude Code", "Claude Code"],
    ["Namera local MCP: research", "research"],
    ["Custom client", "Custom client"],
    ["Namera local MCP: ", "Namera local MCP: "],
  ])("displays %s as %s", (name, expected) => {
    expect(getOAuthClientName(name)).toBe(expected);
  });
});
