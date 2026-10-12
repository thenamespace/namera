const formatDate = (seconds: number) =>
  new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function LifetimeSummary({
  validAfter,
  validUntil,
}: {
  validAfter: number;
  validUntil: number;
}) {
  return (
    <span>
      {validAfter ? `Starts ${formatDate(validAfter)}` : "Starts immediately"}
      {" · "}
      {validUntil ? `Expires ${formatDate(validUntil)}` : "Choose an expiry date."}
    </span>
  );
}
