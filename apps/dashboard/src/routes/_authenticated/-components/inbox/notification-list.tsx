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
          "group relative flex w-full cursor-pointer items-start gap-3 rounded-lg px-3 py-3 text-left outline-none transition-colors",
          "hover:bg-default focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
          isSelected ? "bg-default" : "bg-transparent",
        )}
        type="button"
        onClick={selectItem}
      >
        <span className="relative shrink-0">
          <NotificationIcon className="size-9" type={item.notification.type} />
          {item.readAt === null ? (
            <span
              aria-label="Unread"
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-background"
            />
          ) : null}
        </span>

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
  return (
    <div className={cn("px-2 pb-3", items.length === 0 && "flex min-h-full flex-col")}>
      {items.length === 0 ? (
        <div className="grid min-h-72 flex-1 place-items-center px-6 py-8">
          <div className="flex max-w-56 flex-col items-center gap-1 text-center">
            <div className="mb-2 grid size-10 place-items-center rounded-lg bg-default text-muted">
              <HugeiconsIcon className="size-5" icon={InboxIcon} />
            </div>
            <Typography align="center" className="text-sm! leading-5!" weight="medium">
              No notifications
            </Typography>
            <Typography align="center" className="text-xs! leading-5!" color="muted">
              New account and workspace activity will appear here.
            </Typography>
          </div>
        </div>
      ) : (
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
      )}

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
