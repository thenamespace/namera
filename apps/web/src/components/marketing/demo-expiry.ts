export const formatDemoExpiry = (today: Date): string => {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 3;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const expiry = new Date(Date.UTC(year, month, Math.min(today.getUTCDate(), lastDay)));

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(expiry);
};
