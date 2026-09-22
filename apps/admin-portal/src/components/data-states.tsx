import { Button, Spinner, Typography } from "@namera-ai/ui";

import { asApiFailure } from "@/api/client";

export function DataLoading({ label }: { readonly label: string }) {
  return (
    <output aria-live="polite" className="grid min-h-40 place-items-center gap-3 py-10">
      <Spinner />
      <span className="text-muted text-sm">{label}</span>
    </output>
  );
}

export function DataError({
  error,
  onRetry,
  isRetrying = false,
}: {
  readonly error: unknown;
  readonly onRetry: () => void;
  readonly isRetrying?: boolean;
}) {
  const failure = asApiFailure(error);
  const wait =
    failure.retryAfterSeconds === undefined
      ? null
      : ` Try again in ${failure.retryAfterSeconds} seconds.`;

  return (
    <section className="flex min-h-40 flex-col items-start gap-3 py-10">
      <div role="alert">
        <Typography.Paragraph weight="medium">Request failed</Typography.Paragraph>
        <Typography.Paragraph color="muted" size="sm">
          {failure.message}
          {wait}
        </Typography.Paragraph>
      </div>
      {failure.kind === "unauthorized" ? null : (
        <Button variant="tertiary" onPress={onRetry} isDisabled={isRetrying}>
          {isRetrying ? "Retrying…" : "Try again"}
        </Button>
      )}
    </section>
  );
}

export function EmptyRows({
  filtered,
  onClearFilters,
  subject,
}: {
  readonly filtered: boolean;
  readonly onClearFilters?: () => void;
  readonly subject: string;
}) {
  return (
    <section className="flex min-h-40 flex-col items-start gap-3 py-10">
      <div>
        <Typography.Paragraph weight="medium">
          {filtered ? `No ${subject} match these filters` : `No ${subject} yet`}
        </Typography.Paragraph>
        <Typography.Paragraph color="muted" size="sm">
          {filtered
            ? "Widen the filters, or clear them to see everything."
            : `Nothing has been recorded here. New ${subject} appear as they are created.`}
        </Typography.Paragraph>
      </div>
      {filtered && onClearFilters ? (
        <Button variant="tertiary" onPress={onClearFilters}>
          Clear filters
        </Button>
      ) : null}
    </section>
  );
}
