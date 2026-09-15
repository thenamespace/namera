export function getOAuthClientName(clientName: string): string {
  const profile = clientName.replace(/^Namera local MCP: /, "");
  switch (profile.toLowerCase()) {
    case "codex":
      return "Codex";
    case "claude":
    case "claude code":
      return "Claude Code";
    default:
      return profile || clientName;
  }
}
