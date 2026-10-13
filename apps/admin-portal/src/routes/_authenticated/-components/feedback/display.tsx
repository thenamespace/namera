import { DateTime } from "effect";

import type { FeedbackStatus } from "@namera-ai/protocol/model";
import { Chip } from "@namera-ai/ui";

export const feedbackStatuses = [
  { id: "new", label: "New" },
  { id: "in_review", label: "In review" },
  { id: "planned", label: "Planned" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Closed" },
] as const;
export const feedbackCategories = [
  { id: "bug", label: "Bug report" },
  { id: "feature_request", label: "Feature request" },
  { id: "general", label: "General" },
] as const;
export function FeedbackStatusDisplay({ status }: { status: FeedbackStatus }) {
  return (
    <Chip size="sm" variant="soft" color={status === "completed" ? "success" : "default"}>
      {feedbackStatuses.find((option) => option.id === status)?.label}
    </Chip>
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
