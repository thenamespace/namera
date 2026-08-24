import type { NotificationType } from "@namera-ai/protocol/model";
import { cn } from "@namera-ai/ui";
import { HugeiconsIcon } from "@namera-ai/ui/icons";

import { notificationPresentation } from "./data";

export function NotificationIcon({
  className,
  iconClassName,
  type,
}: {
  readonly className?: string;
  readonly iconClassName?: string;
  readonly type: NotificationType;
}) {
  const presentation = notificationPresentation[type];

  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-lg bg-foreground/10 text-foreground",
        className,
      )}
    >
      <HugeiconsIcon
        className={cn("size-4", iconClassName)}
        icon={presentation.icon}
        strokeWidth={1.8}
      />
    </span>
  );
}
