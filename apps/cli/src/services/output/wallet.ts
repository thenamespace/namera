import type { WalletResponse } from "@namera-ai/protocol/dto";

import { collection, fields, named, type PrettyPrinter } from "./document.js";
import { accountHeading, listArrow, statusText } from "./style.js";

type WalletDisplay = Pick<
  WalletResponse,
  "metadata" | "status" | "address" | "id" | "namespace" | "owner" | "createdAt"
> & { readonly data: Pick<WalletResponse["data"], "validatorType"> };

export const walletView: PrettyPrinter<WalletDisplay> = (wallet, colors) =>
  `${accountHeading(named(wallet.metadata), colors)} | ${statusText(wallet.status, colors)}\n${fields(
    [
      ["Address", wallet.address],
      ["Network type", "EVM"],
      [
        "Custody",
        wallet.owner.custody === "namera-managed"
          ? "Namera-managed"
          : wallet.data.validatorType === "webauthn_p256"
            ? "User-owned passkey"
            : "User-owned key",
      ],
      ["Description", wallet.metadata.description ?? undefined],
      ["Created", wallet.createdAt],
    ],
    colors,
    0,
  )
    .split("\n")
    .map((line) => `${listArrow(colors)} ${line}`)
    .join("\n")}`;

export const walletsView: PrettyPrinter<readonly WalletDisplay[]> = (wallets, colors) =>
  collection(wallets, "delegated wallet", "delegated wallets", walletView, colors);
