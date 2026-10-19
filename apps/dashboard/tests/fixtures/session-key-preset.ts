import { DateTime, Schema } from "effect";

import { WalletResponse } from "@namera-ai/protocol/dto";

import { managedWallet } from "./wallet-transaction";

export const olderSessionAccount = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  metadata: { version: 1, name: "Older account" },
  createdAt: DateTime.makeUnsafe("2026-10-01T00:00:00Z"),
});

export const newestSessionAccount = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  id: "01950000-0000-7000-8000-000000000005",
  metadata: { version: 1, name: "Newest account" },
  createdAt: DateTime.makeUnsafe("2026-10-02T00:00:00Z"),
});

export const frozenSessionAccount = Schema.decodeUnknownSync(Schema.toType(WalletResponse))({
  ...managedWallet,
  id: "01950000-0000-7000-8000-000000000006",
  metadata: { version: 1, name: "Frozen account" },
  status: "frozen",
  createdAt: DateTime.makeUnsafe("2026-10-03T00:00:00Z"),
});

export const sessionPresetAccounts = [
  olderSessionAccount,
  frozenSessionAccount,
  newestSessionAccount,
];
