import { fields, heading, type PrettyPrinter } from "./document.js";
import { listArrow, nextText, paint, successText } from "./style.js";

const permissionNames: Readonly<Record<string, string>> = {
  "mcp:read": "View wallets, session keys, and transaction history",
  "mcp:execute": "Send transactions and sign with authorized session keys",
  offline_access: "Stay connected",
};

export const mcpStatusView: PrettyPrinter<{
  profile: string;
  apiOrigin: string;
  status: string;
  scopes: readonly string[];
}> = (result, colors) =>
  [
    result.status === "connected"
      ? successText("MCP connected to Namera", colors)
      : paint(
          result.status === "refresh-required"
            ? "MCP connection will refresh automatically"
            : "MCP is not connected",
          33,
          colors,
        ),
    fields(
      [
        ["Profile", result.profile],
        ["Server", result.apiOrigin],
      ],
      colors,
      0,
    )
      .split("\n")
      .map((line) => `${listArrow(colors)} ${line}`)
      .join("\n"),
    ...(result.status !== "login-required" && result.scopes.length
      ? [
          `\n${heading("Permissions", colors)}`,
          ...result.scopes.map((scope) => nextText(permissionNames[scope] ?? scope, colors)),
        ]
      : []),
    ...(result.status === "login-required"
      ? [
          `\n${nextText(`Run namera mcp login --profile '${result.profile}' --host '${result.apiOrigin}' to connect.`, colors)}`,
        ]
      : []),
  ].join("\n");

export const mcpLogoutView: PrettyPrinter<{ profile: string }> = ({ profile }, colors) =>
  `${successText(`MCP profile "${profile}" disconnected.`, colors)}\n${nextText("Your wallets and imported session keys are unchanged.", colors)}`;
