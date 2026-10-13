// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { useNavigate } from "@tanstack/react-router";

import type { FeedbackView } from "@namera-ai/protocol/dto";
import { Button, Dropdown, Label, toast } from "@namera-ai/ui";
import { ArrowUpRight01Icon, HugeiconsIcon, MoreHorizontalIcon } from "@namera-ai/ui/icons";

import { hasPermissions, usePermissions, manageFeedbackPermission } from "@/components/permission";
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
  const navigate = useNavigate();
  const canManage = hasPermissions(usePermissions(), manageFeedbackPermission);
  const update = useUpdateFeedbackStatus({
    onSuccess: () => toast.success("Feedback status updated"),
    onError: (error) =>
      toast.danger("Couldn’t update feedback", { description: teamErrorMessage(error) }),
  });
  if (!compact && !canManage) return null;
  return (
    <Dropdown>
      <Button
        variant="tertiary"
        size="sm"
        isIconOnly={compact}
        isDisabled={update.isPending}
        aria-label={`${compact ? "Feedback actions" : "Change feedback status"} for ${entry.user.metadata.name ?? entry.user.email}`}
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
            if (key === "view") {
              void navigate({ to: "/feedback/$feedbackId", params: { feedbackId: entry.id } });
              return;
            }
            const status = feedbackStatuses.find((option) => option.id === key);
            if (status && canManage)
              update.mutate({ params: { id: entry.id }, payload: { status: status.id } });
          }}
        >
          {compact ? (
            <Dropdown.Item id="view" textValue="View feedback">
              <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-4" aria-hidden="true" />
              <Label>View feedback</Label>
            </Dropdown.Item>
          ) : null}
          {feedbackStatuses
            .filter((option) => canManage && option.id !== entry.status)
            .map((option) => (
              <Dropdown.Item
                key={option.id}
                id={option.id}
                textValue={`Mark as ${option.label.toLowerCase()}`}
              >
                <HugeiconsIcon
                  icon={option.icon}
                  className={`size-4 ${option.className}`}
                  aria-hidden="true"
                />
                <Label className={option.className}>Mark as {option.label.toLowerCase()}</Label>
              </Dropdown.Item>
            ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
