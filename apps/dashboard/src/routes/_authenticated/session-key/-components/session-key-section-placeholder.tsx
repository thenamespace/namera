import { EmptyState } from "@namera-ai/ui";
import { Activity01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

export function SessionKeyExecutionsPlaceholder() {
  return (
    <div className="mx-auto flex min-h-72 w-full max-w-5xl items-center justify-center py-8">
      <EmptyState>
        <EmptyState.Header>
          <EmptyState.Media variant="icon">
            <HugeiconsIcon icon={Activity01Icon} />
          </EmptyState.Media>
          <EmptyState.Title>Executions are coming next</EmptyState.Title>
          <EmptyState.Description>
            Confirmed and pending operations for this session key will appear here.
          </EmptyState.Description>
        </EmptyState.Header>
      </EmptyState>
    </div>
  );
}
