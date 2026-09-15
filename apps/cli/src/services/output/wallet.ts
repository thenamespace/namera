import type { WalletResponse } from "@namera-ai/protocol/dto";

import { collection, humanize, named, section, type PrettyPrinter } from "./document.js";

type WalletDisplay = Pick<
  WalletResponse,
  "metadata" | "status" | "address" | "id" | "namespace" | "owner" | "createdAt"
>;

export const walletView: PrettyPrinter<WalletDisplay> = (wallet, colors) =>
  section(
    named(wallet.metadata),
    [
      ["Status", humanize(wallet.status)],
      ["Address", wallet.address],
      ["Wallet ID", wallet.id],
      ["Network type", "EVM"],
      ["Key custody", wallet.owner.custody === "local" ? "Local (user-owned)" : "Namera-managed"],
      ["Implementation", "Alchemy Modular V2"],
      ["Description", wallet.metadata.description ?? undefined],
      ["Created", wallet.createdAt],
    ],
    colors,
  );

export const walletsView: PrettyPrinter<readonly WalletDisplay[]> = (wallets, colors) =>
  collection(wallets, "delegated wallet", "delegated wallets", walletView, colors);
