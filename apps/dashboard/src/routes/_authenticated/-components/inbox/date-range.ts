export const inboxDateRangeOptions = [
  { id: "1d", label: "Last 24 hours", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: null },
] as const;

export type InboxDateRange = (typeof inboxDateRangeOptions)[number]["id"];

export function inboxDateCutoff(range: InboxDateRange | undefined, now: number): number | null {
  const option = inboxDateRangeOptions.find((candidate) => candidate.id === range);
  const days = option === undefined ? 7 : option.days;

  return days === null ? null : now - days * 86_400_000;
}
