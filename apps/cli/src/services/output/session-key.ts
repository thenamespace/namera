import type { SessionKeyResponse } from "@namera-ai/protocol/dto";

import {
  collection,
  humanize,
  named,
  network,
  section,
  timestamp,
  type PrettyPrinter,
} from "./document.js";

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
    section(
      named(key.metadata),
      [
        ["Status", humanize(key.status)],
        ["Session key ID", key.id],
        ["Wallet", key.wallet.metadata.name],
        ["Wallet ID", key.walletId],
        ["Description", key.metadata.description ?? undefined],
        ["Created", key.createdAt],
        ["Revoked", key.revokedAt ?? undefined],
      ],
      colors,
    ),
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

export const sessionKeysView: PrettyPrinter<readonly SessionDisplay[]> = (keys, colors) =>
  collection(
    keys,
    "session key",
    "session keys",
    (key, useColors) =>
      section(
        named(key.metadata),
        [
          ["Status", humanize(key.status)],
          ["Session key ID", key.id],
          ["Wallet", key.wallet.metadata.name],
          ["Wallet ID", key.walletId],
          [
            "Networks",
            key.installations.map(
              (installation) =>
                `${network(installation.chainId)}: ${humanize(installation.status)}`,
            ),
          ],
          ["Created", key.createdAt],
        ],
        useColors,
      ),
    colors,
  );
