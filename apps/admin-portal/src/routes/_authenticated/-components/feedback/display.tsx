import { DateTime } from "effect";

import type { FeedbackView } from "@namera-ai/protocol/dto";
import type { FeedbackStatus } from "@namera-ai/protocol/model";
import { Chip, IconPreview } from "@namera-ai/ui";
import {
  HugeiconsIcon,
  InboxIcon,
  Clock01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  CancelCircleIcon,
} from "@namera-ai/ui/icons";

export const feedbackStatuses = [
  { id: "new", label: "New", icon: InboxIcon, color: "accent", className: "text-accent" },
  {
    id: "in_review",
    label: "In review",
    icon: Clock01Icon,
    color: "warning",
    className: "text-warning",
  },
  {
    id: "planned",
    label: "Planned",
    icon: Calendar03Icon,
    color: "accent",
    className: "text-accent",
  },
  {
    id: "completed",
    label: "Completed",
    icon: CheckmarkCircle02Icon,
    color: "success",
    className: "text-success",
  },
  {
    id: "closed",
    label: "Closed",
    icon: CancelCircleIcon,
    color: "default",
    className: "text-muted",
  },
] as const;
export const feedbackCategories = [
  { id: "bug", label: "Bug report" },
  { id: "feature_request", label: "Feature request" },
  { id: "general", label: "General" },
] as const;
export function FeedbackStatusDisplay({ status }: { status: FeedbackStatus }) {
  const presentation = feedbackStatuses.find((option) => option.id === status);
  if (!presentation) return null;
  return (
    <Chip size="sm" variant="soft" color={presentation.color} className="h-auto w-fit px-2.5 py-1">
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <HugeiconsIcon icon={presentation.icon} size={14} aria-hidden="true" />
        {presentation.label}
      </span>
    </Chip>
  );
}

const organizationFallback = { type: "emoji", value: "🏢" } as const;

export function FeedbackOrganizationDisplay({
  organization,
}: {
  organization: FeedbackView["organization"];
}) {
  if (!organization) return <span className="text-sm text-muted">No organization</span>;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <IconPreview size="xs" value={organization.metadata.logo ?? organizationFallback} />
      <span className="truncate text-sm">{organization.metadata.name}</span>
    </div>
  );
}
export function FeedbackDate({ value }: { value: DateTime.Utc }) {
  return (
    <time
      dateTime={DateTime.formatIso(value)}
      title={DateTime.formatLocal(value, { dateStyle: "medium", timeStyle: "short" })}
      className="text-muted text-sm tabular-nums"
    >
      {DateTime.formatLocal(value, { dateStyle: "medium" })}
    </time>
  );
}
