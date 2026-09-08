import { Button, Typography } from "@namera-ai/ui";

type DataErrorProps = {
  readonly label: string;
  readonly onRetry: () => void;
  readonly isRetrying?: boolean;
};

/** Keep query failures local without exposing provider errors or request URLs. */
export function DataError({ label, onRetry, isRetrying = false }: DataErrorProps) {
  return (
    <section className="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
      <div role="alert">
        <Typography.Paragraph weight="medium">Couldn’t load {label}</Typography.Paragraph>
        <Typography.Paragraph color="muted" size="sm">
          This item may be unavailable, or you may no longer have access. Try again.
        </Typography.Paragraph>
      </div>
      <Button variant="tertiary" onPress={onRetry} isDisabled={isRetrying}>
        {isRetrying ? "Retrying…" : "Try again"}
      </Button>
    </section>
  );
}
