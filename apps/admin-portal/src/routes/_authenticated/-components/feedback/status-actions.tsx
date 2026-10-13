// oxlint-disable react-perf/jsx-no-new-function-as-prop
import type { FeedbackView } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label, toast } from "@namera-ai/ui";
import { HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";

import { PermissionGuard, manageFeedbackPermission } from "@/components/permission";
import { useUpdateFeedbackStatus } from "@/hooks/feedback";
import { teamErrorMessage } from "@/lib/team-feedback";

import { feedbackStatuses } from "./display";

export function FeedbackStatusActions({
  entry,
  compact = false,
}: {
  entry: FeedbackView;
  compact?: boolean;
}) {
  const update = useUpdateFeedbackStatus({
    onSuccess: () => toast.success("Feedback status updated"),
    onError: (error) =>
      toast.danger("Couldn’t update feedback", { description: teamErrorMessage(error) }),
  });
  return (
    <PermissionGuard required={manageFeedbackPermission}>
      <Dropdown>
        <Button
          variant="tertiary"
          size="sm"
          isIconOnly={compact}
          isDisabled={update.isPending}
          aria-label={`Change feedback status for ${entry.user.metadata.name ?? entry.user.email}`}
        >
          {compact ? (
            <HugeiconsIcon icon={MoreHorizontalIcon} />
          ) : update.isPending ? (
            "Updating…"
          ) : (
            "Change status"
          )}
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              const status = feedbackStatuses.find((option) => option.id === key);
              if (status)
                update.mutate({ params: { id: entry.id }, payload: { status: status.id } });
            }}
          >
            {feedbackStatuses
              .filter((option) => option.id !== entry.status)
              .map((option) => (
                <Dropdown.Item
                  key={option.id}
                  id={option.id}
                  textValue={`Mark as ${option.label.toLowerCase()}`}
                >
                  <Label>Mark as {option.label.toLowerCase()}</Label>
                </Dropdown.Item>
              ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </PermissionGuard>
  );
}
