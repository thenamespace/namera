import { DateTime } from "effect";

import { Tooltip } from "@namera-ai/ui";

type DateDisplayProps = {
  label: string;
  value: DateTime.DateTime;
};

export function DateDisplay({ label, value }: DateDisplayProps) {
  const date = DateTime.formatLocal(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const dateTime = DateTime.formatLocal(value, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <Tooltip delay={300}>
      <Tooltip.Trigger
        aria-label={`${label} at ${dateTime}`}
        className="text-muted cursor-help text-sm tabular-nums"
      >
        {date}
      </Tooltip.Trigger>
      <Tooltip.Content showArrow>
        <Tooltip.Arrow />
        {label} at {dateTime}
      </Tooltip.Content>
    </Tooltip>
  );
}

export type { DateDisplayProps };
