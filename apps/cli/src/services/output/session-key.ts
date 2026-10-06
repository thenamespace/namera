import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import {
  fields,
  heading,
  humanize,
  named,
  networkName,
  timestamp,
  type PrettyPrinter,
  type Field,
} from "./document.js";
import { sessionSummary } from "./session-summary.js";
import { accountHeading, listArrow, paint, statusText } from "./style.js";

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

const detailRows = (entries: readonly Field[], colors: boolean) =>
  fields(entries, colors, 0)
    .split("\n")
    .map((line) => `${listArrow(colors)} ${line}`)
    .join("\n");

const policyView = (title: string, parameters: object, colors: boolean) => {
  const details = fields(
    Object.entries(parameters)
      .filter(([label]) => label !== "id" && label !== "version")
      .map(([label, value]) => [humanize(label), value]),
    colors,
    2,
  );
  return `${listArrow(colors)} ${paint(title, title === "Unrestricted account access" ? 33 : 1, colors)}${details ? `\n${details}` : ""}`;
};

export const sessionKeyView: PrettyPrinter<SessionDisplay> = (key, colors) => {
  const expiries = [
    ...new Set(key.installations.map(({ authorization }) => authorization.validUntil)),
  ];
  const expiry = expiries[0];
  const installedNetworks = [
    ...new Set(
      key.installations
        .filter(({ status }) => status === "installed")
        .map(({ chainId }) => networkName(chainId)),
    ),
  ];
  return [
    `${paint(key.metadata.name, 1, colors)} | ${statusText(key.status, colors)}`,
    detailRows(
      [
        ["Account", key.wallet.metadata.name],
        ["Description", key.metadata.description ?? undefined],
        ["Created", key.createdAt],
        [
          "Expires",
          expiries.length === 1 && expiry !== undefined
            ? timestamp(expiry)
            : expiries.length
              ? "Varies by network (see below)"
              : "Not set",
        ],
        ["Networks", installedNetworks.length ? installedNetworks.join(", ") : "None installed"],
        ["Revoked", key.revokedAt ?? undefined],
      ],
      colors,
    ),
    [
      heading("Permissions", colors),
      ...key.installations.map((installation) =>
        [
          `${heading(networkName(installation.chainId), colors)} | ${statusText(installation.status, colors)}`,
          ...(installation.status === "pending" || installation.status === "submitted"
            ? ["Not enabled yet."]
            : []),
          detailRows(
            [
              ...(installation.authorization.validAfter > 0
                ? [["Starts", timestamp(installation.authorization.validAfter)] as const]
                : []),
              [
                "Expires",
                expiries.length > 1 ? timestamp(installation.authorization.validUntil) : undefined,
              ],
              [
                "Message signing",
                installation.authorization.allowSignatures === true ? "Allowed" : "Not allowed",
              ],
            ],
            colors,
          ),
          ...installation.authorization.permissions.map((permission) => {
            const { type, ...parameters } = permission;
            return policyView(
              type === "root" ? "Unrestricted account access" : humanize(type),
              {
                ...parameters,
                ...(type === "native-token-transfer" ? { unit: "wei" } : {}),
                ...(type === "erc20-token-transfer" ? { unit: "token base units" } : {}),
                ...(type === "gas-limit" ? { unit: "gas units" } : {}),
              },
              colors,
            );
          }),
        ].join("\n"),
      ),
      ...(key.installations.length === 0 ? ["No network permissions."] : []),
    ].join("\n\n"),
    [
      heading("API Policies", colors),
      ...(key.policies.length
        ? key.policies.map(({ type, ...parameters }) =>
            policyView(humanize(type.replace(/^evm\./, "")), parameters, colors),
          )
        : [`${listArrow(colors)} None`]),
    ].join("\n"),
  ].join("\n\n");
};

export const sessionKeysView: PrettyPrinter<readonly SessionDisplay[]> = (keys, colors) => {
  if (!keys.length) return "No session keys found.";
  const groups = new Map<string, { name: string; keys: SessionDisplay[] }>();
  for (const key of keys) {
    const group = groups.get(key.walletId) ?? { name: named(key.wallet.metadata), keys: [] };
    group.keys.push(key);
    groups.set(key.walletId, group);
  }
  const now = Date.now();
  return [...groups.values()]
    .map((group) =>
      [
        accountHeading(group.name, colors),
        ...group.keys.map((key) => {
          const activeNetworks =
            key.status === "active"
              ? key.installations.filter(
                  (installation) =>
                    installation.status === "installed" &&
                    installation.authorization.validAfter <= now / 1000 &&
                    installation.authorization.validUntil > now / 1000,
                )
              : [];
          const names = [
            ...new Set(activeNetworks.map((installation) => networkName(installation.chainId))),
          ];
          return [
            sessionSummary(key, colors, key.installations, now),
            `${listArrow(colors)} ${heading("Networks:", colors)} ${names.length ? names.join(", ") : "None active"}`,
          ].join("\n");
        }),
      ].join("\n\n"),
    )
    .join("\n\n");
};
