import { DateTime } from "effect";

import type { EvmChainName } from "@namera-ai/protocol/evm";

const emailDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export const formatEmailDate = (value: DateTime.DateTime) =>
  `${DateTime.formatIntl(value, emailDateFormatter)} UTC`;

export const formatEmailDurationMinutes = (minutes: number) =>
  `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;

export const formatEmailCount = (count: number, singular: string, plural: string) =>
  `${count} ${count === 1 ? singular : plural}`;

export const formatEmailTransactionHash = (hash: string) =>
  `${hash.slice(0, 10)}…${hash.slice(-8)}`;

export const formatEmailEvmAddress = (address: string) =>
  `${address.slice(0, 8)}…${address.slice(-6)}`;

export const getEmailChainIconUrl = (chain: EvmChainName) =>
  `https://cdn.namera.ai/email-assets/chains/${chain}.png`;
