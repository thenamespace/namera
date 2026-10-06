import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import {
  fields,
  heading,
  humanize,
  named,
  network,
  section,
  timestamp,
  type PrettyPrinter,
} from "./document.js";
import { statusText } from "./style.js";

type SessionDisplay = Pick<
  SessionKeyResponse,
  | "metadata"
  | "id"
  | "status"
  | "walletId"
  | "createdAt"
  | "revokedAt"
  | "installations"
  | "policies"
> & {
  readonly wallet: Pick<SessionKeyResponse["wallet"], "metadata">;
};

export const sessionKeyView: PrettyPrinter<SessionDisplay> = (key, colors) =>
  [
    `${heading(named(key.metadata), colors)}  ${statusText(key.status, colors)}\n${fields(
      [
        ["Wallet", key.wallet.metadata.name],
        ["Description", key.metadata.description ?? undefined],
        ["Created", key.createdAt],
        ["Revoked", key.revokedAt ?? undefined],
      ],
      colors,
    )}`,
    ...key.installations.map((installation) =>
      section(
        network(installation.chainId),
        [
          ["Status", humanize(installation.status)],
          ["Signer", installation.authorization.signerAddress],
          [
            "Starts",
            installation.authorization.validAfter === 0
              ? "Immediately after installation"
              : timestamp(installation.authorization.validAfter),
          ],
          ["Expires", timestamp(installation.authorization.validUntil)],
          [
            "Signatures",
            installation.authorization.allowSignatures === true ? "Enabled" : "Disabled",
          ],
          [
            "Onchain permissions",
            installation.authorization.permissions.map((permission) => {
              const { type, ...parameters } = permission;
              return {
                policy: type === "root" ? "Unrestricted account access" : humanize(type),
                ...parameters,
                ...(type === "native-token-transfer" ? { unit: "wei" } : {}),
                ...(type === "erc20-token-transfer" ? { unit: "token base units" } : {}),
                ...(type === "gas-limit" ? { unit: "gas units" } : {}),
              };
            }),
          ],
        ],
        colors,
      ),
    ),
    ...(key.installations.length === 0 ? ["  No network installations."] : []),
    section(
      "Offchain policies",
      [
        [
          "Policies",
          key.policies.map(({ type, ...parameters }) => ({
            policy: humanize(type.replace(/^evm\./, "")),
            ...parameters,
          })),
        ],
      ],
      colors,
    ),
  ].join("\n\n");

export const sessionKeysView: PrettyPrinter<readonly SessionDisplay[]> = (keys, colors) => {
  if (!keys.length) return "No session keys found.";
  const groups = new Map<string, { name: string; keys: SessionDisplay[] }>();
  for (const key of keys) {
    const group = groups.get(key.walletId) ?? { name: named(key.wallet.metadata), keys: [] };
    group.keys.push(key);
    groups.set(key.walletId, group);
  }
  return [
    heading(`${keys.length} session ${keys.length === 1 ? "key" : "keys"}`, colors),
    ...[...groups.values()].map((group) =>
      [
        heading(group.name, colors),
        ...group.keys.map((key) =>
          [
            `  ${heading(named(key.metadata), colors)}  ${statusText(key.status, colors)}`,
            ...(key.installations.length
              ? key.installations.map(
                  (installation) =>
                    `    ${heading(network(installation.chainId), colors)}  ${statusText(installation.status, colors)}`,
                )
              : ["    No networks enabled"]),
          ].join("\n"),
        ),
      ].join("\n"),
    ),
  ].join("\n\n");
};
