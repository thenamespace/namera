import { Metric } from "effect";

export const walletCreationResults = Metric.counter("namera.wallet.creation.results", {
  description: "Wallet creation outcomes by workflow stage",
  incremental: true,
});

export const walletCreationDuration = Metric.timer("namera.wallet.creation.duration", {
  description: "Duration of wallet creation workflows",
});
