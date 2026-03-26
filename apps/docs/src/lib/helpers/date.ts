export const humanizeRelativeTime = (target: Date | number): string => {
  const now = Date.now();
  const targetMs = target instanceof Date ? target.getTime() : target * 1000;

  const diff = targetMs - now;
  const abs = Math.abs(diff);

  const seconds = Math.floor(abs / 1000);

  const units = [
    { label: "year", value: 31_536_000 },
    { label: "month", value: 2_592_000 },
    { label: "day", value: 86_400 },
    { label: "hour", value: 3600 },
    { label: "minute", value: 60 },
    { label: "second", value: 1 },
  ];

  for (const unit of units) {
    if (seconds >= unit.value) {
      const count = Math.floor(seconds / unit.value);

      const formatted = `${count} ${unit.label}${count > 1 ? "s" : ""}`;

      return diff > 0 ? `in ${formatted}` : `${formatted} ago`;
    }
  }

  return "just now";
};
