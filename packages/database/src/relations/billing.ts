import { defineRelationsPart } from "drizzle-orm";

import * as schema from "#/schema/index";

export const billingRelations = defineRelationsPart(schema, (r) => ({
  billingAccount: {
    // Each billing account belongs to one organization.
    organization: r.one.organization({
      from: r.billingAccount.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // One billing account can retain many subscription records.
    subscriptions: r.many.billingSubscription({
      from: r.billingAccount.organizationId,
      to: r.billingSubscription.organizationId,
    }),
    // One billing account can have provider-backed subscription components.
    subscriptionItems: r.many.billingSubscriptionItem({
      from: r.billingAccount.organizationId,
      to: r.billingSubscriptionItem.organizationId,
    }),
    // One billing account can retain many immutable billing periods.
    periods: r.many.billingPeriod({
      from: r.billingAccount.organizationId,
      to: r.billingPeriod.organizationId,
    }),
    // One billing account owns the meter balances within its periods.
    meterBalances: r.many.billingMeterBalance({
      from: r.billingAccount.organizationId,
      to: r.billingMeterBalance.organizationId,
    }),
    // One billing account can hold usage reservations for in-flight work.
    usageReservations: r.many.billingUsageReservation({
      from: r.billingAccount.organizationId,
      to: r.billingUsageReservation.organizationId,
    }),
    // One billing account owns its immutable usage ledger.
    usageEvents: r.many.billingUsageEvent({
      from: r.billingAccount.organizationId,
      to: r.billingUsageEvent.organizationId,
    }),
    // One billing account can have many outbound provider deliveries.
    usageDeliveries: r.many.billingUsageDelivery({
      from: r.billingAccount.organizationId,
      to: r.billingUsageDelivery.organizationId,
    }),
  },
  billingSubscription: {
    // Each billing subscription belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingSubscription.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each billing subscription belongs to one organization.
    organization: r.one.organization({
      from: r.billingSubscription.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // One subscription can contain many separately priced components.
    items: r.many.billingSubscriptionItem({
      from: r.billingSubscription.id,
      to: r.billingSubscriptionItem.subscriptionId,
    }),
    // One subscription retains each historical billing period.
    periods: r.many.billingPeriod({
      from: r.billingSubscription.id,
      to: r.billingPeriod.subscriptionId,
    }),
  },
  billingSubscriptionItem: {
    // Each subscription item belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingSubscriptionItem.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each subscription item belongs to one organization.
    organization: r.one.organization({
      from: r.billingSubscriptionItem.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each subscription item belongs to one subscription.
    subscription: r.one.billingSubscription({
      from: [r.billingSubscriptionItem.subscriptionId, r.billingSubscriptionItem.organizationId],
      to: [r.billingSubscription.id, r.billingSubscription.organizationId],
      optional: false,
    }),
  },
  billingPeriod: {
    // Each period belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingPeriod.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each period belongs to one organization.
    organization: r.one.organization({
      from: r.billingPeriod.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each period belongs to one subscription and snapshots its plan version.
    subscription: r.one.billingSubscription({
      from: [r.billingPeriod.subscriptionId, r.billingPeriod.organizationId],
      to: [r.billingSubscription.id, r.billingSubscription.organizationId],
      optional: false,
    }),
    // A period has one balance row per configured meter.
    meterBalances: r.many.billingMeterBalance({
      from: r.billingPeriod.id,
      to: r.billingMeterBalance.periodId,
    }),
    // A period can hold many temporary usage reservations.
    usageReservations: r.many.billingUsageReservation({
      from: r.billingPeriod.id,
      to: r.billingUsageReservation.periodId,
    }),
    // A period can contain many immutable usage events.
    usageEvents: r.many.billingUsageEvent({
      from: r.billingPeriod.id,
      to: r.billingUsageEvent.periodId,
    }),
  },
  billingMeterBalance: {
    // Each meter balance belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingMeterBalance.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each meter balance belongs to one organization.
    organization: r.one.organization({
      from: r.billingMeterBalance.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each meter balance belongs to one tenant-matched billing period.
    period: r.one.billingPeriod({
      from: [r.billingMeterBalance.periodId, r.billingMeterBalance.organizationId],
      to: [r.billingPeriod.id, r.billingPeriod.organizationId],
      optional: false,
    }),
  },
  billingUsageReservation: {
    // Each reservation belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingUsageReservation.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each reservation belongs to one organization.
    organization: r.one.organization({
      from: r.billingUsageReservation.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each reservation consumes capacity from one tenant-matched period.
    period: r.one.billingPeriod({
      from: [r.billingUsageReservation.periodId, r.billingUsageReservation.organizationId],
      to: [r.billingPeriod.id, r.billingPeriod.organizationId],
      optional: false,
    }),
    // A settled reservation can produce one immutable usage event.
    settlement: r.one.billingUsageEvent({
      from: r.billingUsageReservation.id,
      to: r.billingUsageEvent.reservationId,
    }),
  },
  billingUsageEvent: {
    // Each usage event belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingUsageEvent.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each usage event belongs to one organization.
    organization: r.one.organization({
      from: r.billingUsageEvent.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each usage event belongs to one tenant-matched period.
    period: r.one.billingPeriod({
      from: [r.billingUsageEvent.periodId, r.billingUsageEvent.organizationId],
      to: [r.billingPeriod.id, r.billingPeriod.organizationId],
      optional: false,
    }),
    // A settled event can reference the reservation it consumed.
    reservation: r.one.billingUsageReservation({
      from: [
        r.billingUsageEvent.reservationId,
        r.billingUsageEvent.organizationId,
        r.billingUsageEvent.periodId,
        r.billingUsageEvent.meterKey,
      ],
      to: [
        r.billingUsageReservation.id,
        r.billingUsageReservation.organizationId,
        r.billingUsageReservation.periodId,
        r.billingUsageReservation.meterKey,
      ],
    }),
    // A correction can point to the earlier usage event that it reverses.
    reversedEvent: r.one.billingUsageEvent({
      from: [r.billingUsageEvent.reversesUsageEventId, r.billingUsageEvent.organizationId],
      to: [r.billingUsageEvent.id, r.billingUsageEvent.organizationId],
      alias: "billingUsageEventReversal",
    }),
    // One usage event can be referenced by correction events.
    corrections: r.many.billingUsageEvent({
      from: [r.billingUsageEvent.id, r.billingUsageEvent.organizationId],
      to: [r.billingUsageEvent.reversesUsageEventId, r.billingUsageEvent.organizationId],
      alias: "billingUsageEventReversal",
    }),
    // One usage event can require delivery to one or more provider destinations.
    deliveries: r.many.billingUsageDelivery({
      from: r.billingUsageEvent.id,
      to: r.billingUsageDelivery.usageEventId,
    }),
  },
  billingUsageDelivery: {
    // Each delivery belongs to one billing account.
    account: r.one.billingAccount({
      from: r.billingUsageDelivery.organizationId,
      to: r.billingAccount.organizationId,
      optional: false,
    }),
    // Each delivery belongs to one organization.
    organization: r.one.organization({
      from: r.billingUsageDelivery.organizationId,
      to: r.organization.id,
      optional: false,
    }),
    // Each delivery exports one tenant-matched usage event.
    usageEvent: r.one.billingUsageEvent({
      from: [r.billingUsageDelivery.usageEventId, r.billingUsageDelivery.organizationId],
      to: [r.billingUsageEvent.id, r.billingUsageEvent.organizationId],
      optional: false,
    }),
  },
}));
