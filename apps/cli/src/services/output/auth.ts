import type { CurrentActorResponse, WalletResponse } from "@namera-ai/protocol/dto";

import { date, fields, heading, named, terminalText, type PrettyPrinter } from "./document.js";
import { nextText, paint, statusText, successText } from "./style.js";

const permissions: Readonly<Record<string, string>> = {
  "wallet:read": "View wallets",
  "session-key:read": "View session keys",
  "execution:read": "View transaction history",
  "execution:execute": "Send transactions",
  "signature:create": "Sign messages and typed data",
  offline_access: "Stay signed in",
};

export const loginInstructionsView: PrettyPrinter<{ url: string; code: string }> = (
  { url, code },
  colors,
) =>
  [
    heading("Approve your CLI connection in the browser", colors),
    `  ${paint(url, 34, colors)}`,
    `\n  Confirm this code: ${paint(code, 1, colors)}`,
    "\nWaiting for your approval...",
  ].join("\n");

export const loginView: PrettyPrinter<{ profile: string }> = ({ profile }, colors) =>
  `${successText(`Signed in as "${profile}".`, colors)}\n${nextText("Run namera wallet list to see your wallets.", colors)}`;

export const logoutView: PrettyPrinter<{ profile: string }> = ({ profile }, colors) =>
  `${successText(`Signed out of "${profile}" on this device.`, colors)}\n${nextText("Run namera login to reconnect. Your imported keys are still saved.", colors)}`;

export const authView: PrettyPrinter<{
  readonly profile: string;
  readonly actor: CurrentActorResponse;
  readonly organizationName?: string;
  readonly wallets?: readonly Pick<WalletResponse, "id" | "metadata">[];
}> = ({ profile, actor, organizationName, wallets = [] }, colors) => {
  const authorization = "authorization" in actor.data ? actor.data.authorization : undefined;
  const groups = new Map<string, { name: string; keys: string[] }>();
  if ("grants" in actor.data) {
    for (const { sessionKey } of actor.data.grants) {
      const group = groups.get(sessionKey.walletId) ?? {
        name:
          wallets.find((wallet) => wallet.id === sessionKey.walletId)?.metadata.name ??
          `Wallet ${sessionKey.walletId}`,
        keys: [],
      };
      group.keys.push(
        `    ${terminalText(named(sessionKey.metadata))}  ${statusText(sessionKey.status, colors)}`,
      );
      groups.set(sessionKey.walletId, group);
    }
  }
  return [
    successText(
      actor.type === "api-key" ? "Connected with an API key" : "Connected to Namera",
      colors,
    ),
    fields(
      [
        ["Profile", profile],
        [
          "Organization",
          actor.type === "user"
            ? actor.data.organization.metadata.name
            : (actor.data.organizationName ??
              organizationName ??
              "Name unavailable (update the server)"),
        ],
        ...(authorization?.expiresAt ? [["Expires", date(authorization.expiresAt)] as const] : []),
      ],
      colors,
    ),
    ...(authorization
      ? [
          `\n${heading("Permissions", colors)}`,
          ...authorization.scopes.map((scope) => `  ${terminalText(permissions[scope] ?? scope)}`),
          "  Within your session keys' limits.",
        ]
      : []),
    `\n${heading("Session keys", colors)}`,
    ...(groups.size
      ? [...groups.values()].map(
          (group) => `  ${heading(group.name, colors)}\n${group.keys.join("\n")}`,
        )
      : ["  No session keys shared with this connection."]),
  ].join("\n");
};
