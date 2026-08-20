import { Metric } from "effect";

export const billingMeterTransitions = Metric.counter("namera.billing.meter.transitions", {
  description: "Transactional billing meter reservation and settlement outcomes",
  incremental: true,
});

export const billingPeriodRollovers = Metric.counter("namera.billing.period.rollovers", {
  description: "Organization anniversary billing periods created by rollover",
  incremental: true,
});

export const billingRecoveryResults = Metric.counter("namera.billing.recovery.results", {
  description: "Billing reservation recovery outcomes",
  incremental: true,
});

export const billingProjectionRepairs = Metric.counter("namera.billing.projection.repairs", {
  description: "Meter balance projections repaired from the usage ledger",
  incremental: true,
});
