import { useCallback } from "react";

import type { NotificationId } from "@namera-ai/protocol";
import type { NotificationResponse } from "@namera-ai/protocol/dto";
import { Button, cn, Spinner, Typography } from "@namera-ai/ui";
import { HugeiconsIcon, InboxIcon } from "@namera-ai/ui/icons";

import { formatNotificationTime, notificationPresentation } from "./data";
import { NotificationIcon } from "./notification-icon";

type NotificationListProps = {
  readonly canLoadMore: boolean;
  readonly isLoadingMore: boolean;
  readonly items: ReadonlyArray<NotificationResponse>;
  readonly selectedId: NotificationId | null;
  readonly onLoadMore: () => void;
  readonly onSelect: (item: NotificationResponse) => void;
};

function NotificationListItem({
  item,
  isSelected,
  onSelect,
}: {
  readonly isSelected: boolean;
  readonly item: NotificationResponse;
  readonly onSelect: (item: NotificationResponse) => void;
}) {
  const presentation = notificationPresentation[item.notification.type];
  const selectItem = useCallback(() => onSelect(item), [item, onSelect]);

  return (
    <li>
      <button
        aria-current={isSelected ? "true" : undefined}
        className={cn(
          "group relative flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left outline-none transition-colors",
          "hover:bg-secondary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
          isSelected ? "bg-secondary" : "bg-transparent",
        )}
        type="button"
        onClick={selectItem}
      >
        <NotificationIcon className="size-9" type={item.notification.type} />

        <div className="min-w-0 flex-1">
          <div className="flex h-5 items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm leading-5",
                item.readAt === null ? "font-medium text-foreground" : "text-muted",
              )}
            >
              {presentation.title}
            </span>
            <time className="shrink-0 pt-0.5 text-[11px] tabular-nums text-muted">
              {formatNotificationTime(item.receivedAt)}
            </time>
          </div>
          <p className="truncate text-xs leading-4 text-muted">{presentation.preview}</p>
        </div>

        {item.readAt === null ? (
          <span
            aria-label="Unread"
            className="absolute bottom-3 left-1 size-1.5 rounded-full bg-accent"
          />
        ) : null}
      </button>
    </li>
  );
}

export function NotificationList({
  canLoadMore,
  isLoadingMore,
  items,
  selectedId,
  onLoadMore,
  onSelect,
}: NotificationListProps) {
  if (items.length === 0) {
    return (
      <div className="grid min-h-72 place-items-center px-6 py-12 text-center">
        <div>
          <div className="mx-auto grid size-10 place-items-center rounded-lg bg-secondary text-muted">
            <HugeiconsIcon className="size-5" icon={InboxIcon} />
          </div>
          <Typography className="mt-3 text-sm!" weight="medium">
            No notifications
          </Typography>
          <Typography className="mt-1 text-xs!" color="muted">
            New account and workspace activity will appear here.
          </Typography>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-3">
      <ul aria-label="Notifications" className="space-y-0.5">
        {items.map((item) => (
          <NotificationListItem
            isSelected={item.notification.id === selectedId}
            item={item}
            key={item.notification.id}
            onSelect={onSelect}
          />
        ))}
      </ul>

      {canLoadMore ? (
        <Button
          className="mt-2 w-full"
          isDisabled={isLoadingMore}
          size="sm"
          variant="tertiary"
          onPress={onLoadMore}
        >
          {isLoadingMore ? <Spinner className="size-4" /> : null}
          {isLoadingMore ? "Loading" : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}

export type { NotificationListProps };
