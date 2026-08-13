import { Metric } from "effect";

export const walletCreationResults = Metric.frequency("namera.wallet.creation.results", {
  description: "Wallet creation outcomes by workflow stage",
  preregisteredWords: [
    "success",
    "limit_exceeded",
    "key_failed",
    "account_failed",
    "persistence_failed",
  ],
});

export const walletCreationDuration = Metric.timer("namera.wallet.creation.duration", {
  description: "Duration of wallet creation workflows",
});
