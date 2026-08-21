import { DateTime } from "effect";

import type {
  BillingMeterUsage,
  BillingResourceUsage,
  GetBillingResponse,
} from "@namera-ai/protocol/dto";
import { Chip, Meter, Surface, Typography } from "@namera-ai/ui";
import {
  CalendarClockIcon,
  CreditCardIcon,
  HugeiconsIcon,
  type IconSvgElement,
} from "@namera-ai/ui/icons";

import { HeadingGroup } from "@/components/heading-group";
import { useBilling } from "@/hooks/billing";

import { formatBillingAmount, getMeterColor, meterDefinitions, resourceDefinitions } from "./data";

type BillingOverviewProps = {
  initialBilling: GetBillingResponse;
};

type UsageRowProps = {
  description: string;
  icon: IconSvgElement;
  label: string;
  maximum: bigint;
  pending?: bigint;
  unit: BillingMeterUsage["unit"] | "resource";
  value: bigint;
};

function UsageRow({ description, icon, label, maximum, pending = 0n, unit, value }: UsageRowProps) {
  const hasAllowance = maximum > 0n;
  const displayMaximum = hasAllowance ? maximum : 1n;

  return (
    <div className="min-w-0 py-3">
      <div className="mb-2.5 flex items-start gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-muted">
          <HugeiconsIcon icon={icon} size={15} strokeWidth={1.8} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <Typography className="text-sm font-medium">{label}</Typography>
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {hasAllowance
                ? `${formatBillingAmount(value, unit)} / ${formatBillingAmount(maximum, unit)}`
                : "Not included"}
            </span>
          </div>
          <Typography.Paragraph className="mt-0.5" color="muted" size="xs">
            {description}
            {pending > 0n ? ` · ${formatBillingAmount(pending, unit)} currently reserved` : ""}
          </Typography.Paragraph>
        </div>
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
    </div>
  );
}

function ResourceUsage({ usage }: { usage: BillingResourceUsage }) {
  const definition = resourceDefinitions.find(({ key }) => key === usage.key);
  if (definition === undefined) return null;

  return (
    <UsageRow
      description={definition.description}
      icon={definition.icon}
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
      description={definition.description}
      icon={definition.icon}
      label={definition.label}
      maximum={usage.hardLimitAmount ?? usage.includedAmount}
      pending={usage.reservedAmount}
      unit={usage.unit}
      value={usage.consumedAmount + usage.reservedAmount}
    />
  );
}

function BillingPeriod({ billing }: { billing: GetBillingResponse }) {
  const startsAt = DateTime.toEpochMillis(billing.period.startsAt);
  const endsAt = DateTime.toEpochMillis(billing.period.endsAt);
  const elapsed = Math.min(Math.max(Date.now() - startsAt, 0), endsAt - startsAt);
  const duration = Math.max(endsAt - startsAt, 1);
  const resetDate = DateTime.formatLocal(billing.period.endsAt, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mt-5 border-t border-border pt-4">
      <div className="mb-2 flex items-center justify-between gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <HugeiconsIcon icon={CalendarClockIcon} size={14} />
          Current billing period
        </span>
        <span className="tabular-nums">Resets {resetDate}</span>
      </div>
      <Meter
        aria-label="Current billing period elapsed"
        color="default"
        maxValue={duration}
        size="sm"
        value={elapsed}
      >
        <Meter.Track>
          <Meter.Fill />
        </Meter.Track>
      </Meter>
    </div>
  );
}

export function BillingOverview({ initialBilling }: BillingOverviewProps) {
  const query = useBilling();
  const billing = query.data ?? initialBilling;

  return (
    <div className="space-y-10">
      <section aria-labelledby="current-plan-heading">
        <HeadingGroup className="mb-4">
          <HeadingGroup.Title id="current-plan-heading">Current plan</HeadingGroup.Title>
        </HeadingGroup>
        <Surface className="overflow-hidden rounded-xl border p-5 sm:p-6" variant="secondary">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-tertiary text-foreground">
                <HugeiconsIcon icon={CreditCardIcon} size={19} strokeWidth={1.8} />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <Typography.Heading
                    className="text-lg"
                    id="free-plan-heading"
                    level={3}
                    weight="medium"
                  >
                    Free
                  </Typography.Heading>
                  <Chip color="success" size="sm" variant="tertiary">
                    Active
                  </Chip>
                </div>
                <Typography.Paragraph className="mt-1" color="muted" size="sm">
                  Your workspace is using the Free plan.
                </Typography.Paragraph>
              </div>
            </div>
            <div className="sm:text-right">
              <div className="text-xl font-medium tabular-nums text-foreground">$0</div>
              <div className="text-xs text-muted">per month</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {billing.resources
              .filter(({ includedAmount }) => includedAmount > 0n)
              .map((resource) => {
                const definition = resourceDefinitions.find(({ key }) => key === resource.key);
                if (definition === undefined) return null;
                return (
                  <div className="bg-surface px-3.5 py-3" key={resource.key}>
                    <div className="text-sm font-medium tabular-nums text-foreground">
                      {formatBillingAmount(resource.includedAmount, "resource")}
                    </div>
                    <div className="mt-0.5 text-xs text-muted">{definition.label}</div>
                  </div>
                );
              })}
            {billing.meters.map((meter) => {
              const definition = meterDefinitions.find(({ key }) => key === meter.key);
              if (definition === undefined) return null;
              return (
                <div className="bg-surface px-3.5 py-3" key={meter.key}>
                  <div className="text-sm font-medium tabular-nums text-foreground">
                    {formatBillingAmount(meter.includedAmount, meter.unit)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{definition.label}</div>
                </div>
              );
            })}
          </div>
          <BillingPeriod billing={billing} />
        </Surface>
      </section>

      <section aria-labelledby="usage-heading">
        <HeadingGroup className="mb-4">
          <HeadingGroup.Title id="usage-heading">Usage</HeadingGroup.Title>
          <HeadingGroup.Description>
            Usage updates as operations complete. Reserved amounts include work still in progress.
          </HeadingGroup.Description>
        </HeadingGroup>
        <Surface className="rounded-xl border px-5 py-2 sm:px-6" variant="secondary">
          <div className="grid gap-x-10 lg:grid-cols-2">
            <div>
              <Typography className="pb-1 pt-4 text-xs font-medium" color="muted">
                Workspace capacity
              </Typography>
              {billing.resources.map((usage) => (
                <ResourceUsage key={usage.key} usage={usage} />
              ))}
            </div>
            <div>
              <Typography className="pb-1 pt-4 text-xs font-medium" color="muted">
                Monthly allowance
              </Typography>
              {billing.meters.map((usage) => (
                <MeterUsage key={usage.key} usage={usage} />
              ))}
            </div>
          </div>
        </Surface>
      </section>

      <section aria-labelledby="plans-heading">
        <Surface className="flex items-start gap-3 rounded-xl border p-5" variant="secondary">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-tertiary text-muted">
            <HugeiconsIcon icon={CreditCardIcon} size={16} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Typography.Heading className="text-sm" id="plans-heading" level={2} weight="medium">
                More plans
              </Typography.Heading>
              <Chip size="sm" variant="tertiary">
                Coming soon
              </Chip>
            </div>
            <Typography.Paragraph className="mt-1" color="muted" size="sm">
              Higher limits and paid plans will be available later.
            </Typography.Paragraph>
          </div>
        </Surface>
      </section>
    </div>
  );
}
