import { describe, expect, it } from "vitest";

import { mcpLogoutView, mcpStatusView } from "../../src/services/output/mcp.js";

const status = {
  profile: "personal",
  apiOrigin: "https://api.namera.ai",
  status: "connected",
  scopes: ["mcp:read", "mcp:execute", "offline_access"],
};
describe("MCP human output", () => {
  it("shows readable permissions and arrow rows", () => {
    const text = mcpStatusView(status, false);
    expect(text).toContain("MCP connected to Namera");
    expect(text).toContain("-> Profile: personal");
    expect(text).toContain("-> Server: https://api.namera.ai");
    expect(text).toContain("View wallets, session keys, and transaction history");
    expect(text).not.toContain("mcp:execute");
    expect(text).not.toContain("\u001b");
  });
  it("does not ask users to log in for automatic refresh", () => {
    const text = mcpStatusView({ ...status, status: "refresh-required" }, true);
    expect(text).toContain("will refresh automatically");
    expect(text).not.toContain("namera mcp login");
    expect(text).toContain("\u001b[33m");
  });
  it("gives a profile- and server-specific reconnect command", () => {
    const text = mcpStatusView({ ...status, status: "login-required" }, false);
    expect(text).toContain("namera mcp login --profile 'personal' --host 'https://api.namera.ai'");
    expect(text).not.toContain("Permissions");
  });
  it("explains what logout leaves unchanged", () => {
    expect(mcpLogoutView({ profile: "personal" }, false)).toContain(
      "Your wallets and imported session keys are unchanged.",
    );
  });
});
