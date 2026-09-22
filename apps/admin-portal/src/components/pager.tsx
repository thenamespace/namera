import { Button } from "@namera-ai/ui";

export function Pager({
  canGoBack,
  isFetching,
  nextCursor,
  onBack,
  onNext,
  shown,
}: {
  readonly canGoBack: boolean;
  readonly isFetching: boolean;
  readonly nextCursor: string | null;
  readonly onBack: () => void;
  readonly onNext: () => void;
  readonly shown: number;
}) {
  if (!canGoBack && nextCursor === null) {
    return (
      <p className="text-muted py-3 text-sm" aria-live="polite">
        {shown} {shown === 1 ? "row" : "rows"}
      </p>
    );
  }

  return (
    <nav aria-label="Pagination" className="flex flex-wrap items-center gap-3 py-3">
      <Button variant="tertiary" onPress={onBack} isDisabled={!canGoBack || isFetching}>
        Previous
      </Button>
      <Button variant="tertiary" onPress={onNext} isDisabled={nextCursor === null || isFetching}>
        Next
      </Button>
      <span className="text-muted text-sm" aria-live="polite">
        {shown} {shown === 1 ? "row" : "rows"} on this page
      </span>
    </nav>
  );
}
