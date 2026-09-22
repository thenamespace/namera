import { DateTime } from "effect";

const absolute = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const compact = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function Timestamp({
  fallback = "Never",
  value,
}: {
  readonly fallback?: string;
  readonly value: DateTime.Utc | null;
}) {
  if (!value) return <span className="text-muted">{fallback}</span>;
  const date = DateTime.toDateUtc(value);
  return (
    <time dateTime={date.toISOString()} title={absolute.format(date)}>
      {compact.format(date)}
    </time>
  );
}
