import { DateTime } from "effect";

import type {
  BillingMeterUsage,
  BillingResourceUsage,
  GetBillingResponse,
} from "@namera-ai/protocol/dto";
import { Meter, Surface, Typography } from "@namera-ai/ui";
import { CheckIcon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { HeadingGroup } from "@/components/heading-group";

import { formatBillingAmount, getMeterColor, meterDefinitions, resourceDefinitions } from "./data";

type BillingOverviewProps = {
  billing: GetBillingResponse;
};

type UsageRowProps = {
  label: string;
  maximum: bigint;
  pending?: bigint;
  unit: BillingMeterUsage["unit"] | "resource";
  value: bigint;
};

function UsageRow({ label, maximum, pending = 0n, unit, value }: UsageRowProps) {
  const hasAllowance = maximum > 0n;
  const displayMaximum = hasAllowance ? maximum : 1n;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <Typography className="text-sm!" weight="medium">
          {label}
        </Typography>
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {hasAllowance
            ? `${formatBillingAmount(value, unit)} / ${formatBillingAmount(maximum, unit)}`
            : "Not included"}
        </span>
      </div>
      <Meter
        aria-label={`${label} usage`}
        color={getMeterColor(value, maximum)}
        maxValue={Number(displayMaximum)}
        size="sm"
        value={Number(hasAllowance ? value : 0n)}
      >
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
      {pending > 0n ? (
        <p className="mt-1.5 text-xs tabular-nums text-muted">
          Includes {formatBillingAmount(pending, unit)} reserved
        </p>
      ) : null}
    </div>
  );
}

function ResourceUsage({ usage }: { usage: BillingResourceUsage }) {
  const definition = resourceDefinitions.find(({ key }) => key === usage.key);
  if (definition === undefined || usage.includedAmount === 0n) return null;

  return (
    <UsageRow
      label={definition.label}
      maximum={usage.includedAmount}
      unit="resource"
      value={usage.usedAmount}
    />
  );
}

function MeterUsage({ usage }: { usage: BillingMeterUsage }) {
  const definition = meterDefinitions.find(({ key }) => key === usage.key);
  if (definition === undefined) return null;

  return (
    <UsageRow
      label={definition.label}
      maximum={usage.hardLimitAmount ?? usage.includedAmount}
      pending={usage.reservedAmount}
      unit={usage.unit}
      value={usage.consumedAmount + usage.reservedAmount}
    />
  );
}

function IncludedItem({ amount, label }: { amount: string; label: string }) {
  return (
    <li className="flex min-w-0 items-center gap-1.5">
      <HugeiconsIcon
        aria-hidden
        className="size-4 shrink-0 text-accent"
        icon={CheckIcon}
        strokeWidth={2.5}
      />
      <span className="min-w-0 text-sm text-muted">
        <span className="font-medium tabular-nums text-foreground">{amount}</span> {label}
      </span>
    </li>
  );
}

function CurrentPlan({ billing }: { billing: GetBillingResponse }) {
  return (
    <section aria-labelledby="current-plan-heading">
      <HeadingGroup className="mb-4">
        <HeadingGroup.Title id="current-plan-heading">Current plan</HeadingGroup.Title>
      </HeadingGroup>

      <Surface className="overflow-hidden rounded-xl border" variant="secondary">
        <div className="flex items-center justify-between gap-6 px-5 py-4 sm:px-6">
          <div>
            <div className="flex items-center gap-2.5">
              <Typography.Heading className="text-base" level={3} weight="medium">
                Free plan
              </Typography.Heading>
            </div>
            <Typography.Paragraph className="mt-1" color="muted" size="xs">
              Everything you need to build and test with Namera.
            </Typography.Paragraph>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-base font-medium tabular-nums text-foreground">$0</div>
            <div className="text-xs text-muted">per month</div>
          </div>
        </div>

        <ul className="grid gap-x-6 gap-y-2 border-t border-border px-5 py-5 sm:grid-cols-1 sm:px-6 lg:grid-cols-3">
          {billing.resources
            .filter(({ includedAmount }) => includedAmount > 0n)
            .map((resource) => {
              const definition = resourceDefinitions.find(({ key }) => key === resource.key);
              if (definition === undefined) return null;
              return (
                <IncludedItem
                  amount={formatBillingAmount(resource.includedAmount, "resource")}
                  key={resource.key}
                  label={definition.planLabel}
                />
              );
            })}
          {billing.meters.map((meter) => {
            const definition = meterDefinitions.find(({ key }) => key === meter.key);
            if (definition === undefined) return null;
            return (
              <IncludedItem
                amount={formatBillingAmount(meter.includedAmount, meter.unit)}
                key={meter.key}
                label={definition.planLabel}
              />
            );
          })}
        </ul>
      </Surface>
    </section>
  );
}

function CurrentUsage({ billing }: { billing: GetBillingResponse }) {
  const resetDate = DateTime.formatLocal(billing.period.endsAt, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <section aria-labelledby="current-usage-heading">
      <div className="mb-4 flex items-end justify-between gap-6">
        <HeadingGroup>
          <HeadingGroup.Title id="current-usage-heading">Current usage</HeadingGroup.Title>
          <HeadingGroup.Description>
            Current accounts and members, plus this period’s operation usage.
          </HeadingGroup.Description>
        </HeadingGroup>
        <span className="shrink-0 pb-0.5 text-xs tabular-nums text-muted">Resets {resetDate}</span>
      </div>

      <Surface className="rounded-xl border px-5 py-5 sm:px-6" variant="secondary">
        <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {billing.resources.map((usage) => (
            <ResourceUsage key={usage.key} usage={usage} />
          ))}
          {billing.meters.map((usage) => (
            <MeterUsage key={usage.key} usage={usage} />
          ))}
        </div>
      </Surface>
    </section>
  );
}

export function BillingOverview({ billing }: BillingOverviewProps) {
  return (
    <div className="space-y-9">
      <CurrentPlan billing={billing} />
      <CurrentUsage billing={billing} />
    </div>
  );
}
