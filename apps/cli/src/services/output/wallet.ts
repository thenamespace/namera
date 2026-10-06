import type { WalletResponse } from "@namera-ai/protocol/dto";

import { collection, fields, named, type PrettyPrinter } from "./document.js";
import { accountHeading, statusText } from "./style.js";

type WalletDisplay = Pick<
  WalletResponse,
  "metadata" | "status" | "address" | "id" | "namespace" | "owner" | "createdAt"
>;

export const walletView: PrettyPrinter<WalletDisplay> = (wallet, colors) =>
  `${accountHeading(named(wallet.metadata), colors)} | ${statusText(wallet.status, colors)}\n${fields(
    [
      ["Address", wallet.address],
      ["Network type", "EVM"],
      ["Description", wallet.metadata.description ?? undefined],
      ["Created", wallet.createdAt],
    ],
    colors,
    0,
  )}`;

export const walletsView: PrettyPrinter<readonly WalletDisplay[]> = (wallets, colors) =>
  collection(wallets, "delegated wallet", "delegated wallets", walletView, colors);
