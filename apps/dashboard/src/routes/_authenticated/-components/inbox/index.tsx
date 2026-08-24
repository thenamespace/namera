import { useEffect, useMemo, useState } from "react";

import type { NotificationId } from "@namera-ai/protocol";
import type { ListNotificationsResponse, NotificationResponse } from "@namera-ai/protocol/dto";
import { Button, SearchField, Sidebar, Spinner, Tooltip, Typography } from "@namera-ai/ui";
import {
  ArchiveIcon,
  CheckmarkCircle02Icon,
  ChevronLeftIcon,
  HugeiconsIcon,
  InboxIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { TableFilterControl } from "@/components/common/table";
import { DataLoading } from "@/components/data-loading";
import { HeadingGroup } from "@/components/heading-group";
import { DashboardPage } from "@/components/page";
import {
  useArchiveNotification,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/notification";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import { useInboxFilters } from "./filters";
import { NotificationDetail } from "./notification-detail";
import { NotificationList } from "./notification-list";

function NotificationPageLoader({
  cursor,
  onData,
}: {
  readonly cursor: NotificationId;
  readonly onData: (cursor: NotificationId, page: ListNotificationsResponse) => void;
}) {
  const query = useNotifications(cursor);

  useEffect(() => {
    if (query.data !== undefined) onData(cursor, query.data);
  }, [cursor, onData, query.data]);

  return null;
}

function NotificationEmptyDetail() {
  return (
    <div className="grid h-full min-h-80 place-items-center px-6 py-12 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-xl border bg-secondary text-muted shadow-sm">
          <HugeiconsIcon className="size-6" icon={InboxIcon} />
        </div>
        <Typography className="mt-4 text-sm!" weight="medium">
          Select a notification
        </Typography>
        <Typography className="mt-1 max-w-64 text-xs!" color="muted">
          Choose an item from the inbox to review its details and related resource.
        </Typography>
      </div>
    </div>
  );
}

type DetailToolbarProps = {
  readonly canMarkRead: boolean;
  readonly onArchive: () => void;
  readonly onBack: () => void;
  readonly onMarkRead: () => void;
};

function DetailToolbar({ canMarkRead, onArchive, onBack, onMarkRead }: DetailToolbarProps) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between border-b px-3 sm:px-4">
      <Button
        isIconOnly
        aria-label="Back to notifications"
        className="lg:hidden"
        size="sm"
        variant="tertiary"
        onPress={onBack}
      >
        <HugeiconsIcon icon={ChevronLeftIcon} />
      </Button>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-1">
        {canMarkRead ? (
          <Tooltip delay={300}>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                aria-label="Mark notification as read"
                size="sm"
                variant="tertiary"
                onPress={onMarkRead}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content showArrow>
              <Tooltip.Arrow />
              Mark as read
            </Tooltip.Content>
          </Tooltip>
        ) : null}

        <Tooltip delay={300}>
          <Tooltip.Trigger>
            <Button
              isIconOnly
              aria-label="Archive notification"
              size="sm"
              variant="tertiary"
              onPress={onArchive}
            >
              <HugeiconsIcon icon={ArchiveIcon} />
            </Button>
          </Tooltip.Trigger>
          <Tooltip.Content showArrow>
            <Tooltip.Arrow />
            Archive
          </Tooltip.Content>
        </Tooltip>
      </div>
    </div>
  );
}

export function Inbox() {
  const firstPage = useNotifications();
  const unreadCountQuery = useUnreadNotificationCount();
  const [additionalCursors, setAdditionalCursors] = useState<ReadonlyArray<NotificationId>>([]);
  const [additionalPages, setAdditionalPages] = useState<
    ReadonlyMap<NotificationId, ListNotificationsResponse>
  >(new Map());
  const [selectedId, setSelectedId] = useState<NotificationId | null>(null);
  const [readOverrides, setReadOverrides] = useState<ReadonlySet<NotificationId>>(new Set());
  const [archivedOverrides, setArchivedOverrides] = useState<ReadonlySet<NotificationId>>(
    new Set(),
  );
  const [allReadOverride, setAllReadOverride] = useState(false);

  const markRead = useMarkNotificationRead({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t mark notification as read",
        description: "Try again.",
      }),
  });
  const markAllRead = useMarkAllNotificationsRead({
    onError: (error) =>
      showErrorToast(error, {
        title: "Couldn’t mark notifications as read",
        description: "Try again.",
      }),
  });
  const archive = useArchiveNotification({
    onError: (error) =>
      showErrorToast(error, { title: "Couldn’t archive notification", description: "Try again." }),
    onSuccess: () => showSuccessToast({ title: "Notification archived" }),
  });

  const handleAdditionalPage = useEventCallback(
    (cursor: NotificationId, page: ListNotificationsResponse) => {
      setAdditionalPages((current) => {
        if (current.get(cursor) === page) return current;
        const next = new Map(current);
        next.set(cursor, page);
        return next;
      });
    },
  );

  const items = useMemo(() => {
    const byId = new Map<NotificationId, NotificationResponse>();
    for (const item of firstPage.data?.items ?? []) byId.set(item.notification.id, item);
    for (const cursor of additionalCursors) {
      for (const item of additionalPages.get(cursor)?.items ?? []) {
        if (!byId.has(item.notification.id)) byId.set(item.notification.id, item);
      }
    }

    const visibleItems: Array<NotificationResponse> = [];
    for (const item of byId.values()) {
      if (archivedOverrides.has(item.notification.id)) continue;
      visibleItems.push(
        allReadOverride || readOverrides.has(item.notification.id)
          ? { ...item, readAt: item.readAt ?? item.receivedAt }
          : item,
      );
    }

    return visibleItems;
  }, [
    additionalCursors,
    additionalPages,
    allReadOverride,
    archivedOverrides,
    firstPage.data,
    readOverrides,
  ]);

  const { clearFilters, filteredItems, filterFacets, query, setQuery } = useInboxFilters(items);

  const selected = filteredItems.find((item) => item.notification.id === selectedId);
  const unreadCount = allReadOverride
    ? 0
    : (unreadCountQuery.data?.count ?? items.filter((item) => item.readAt === null).length);
  const lastPage =
    additionalCursors.length === 0
      ? firstPage.data
      : additionalPages.get(additionalCursors.at(-1) as NotificationId);
  const nextCursor = lastPage?.nextCursor;
  const isLoadingMore = additionalCursors.some((cursor) => !additionalPages.has(cursor));

  const selectNotification = useEventCallback((item: NotificationResponse) => {
    setSelectedId(item.notification.id);
    if (item.readAt !== null || readOverrides.has(item.notification.id) || allReadOverride) return;

    setReadOverrides((current) => new Set(current).add(item.notification.id));
    markRead.mutate({ payload: { notificationId: item.notification.id } });
  });
  const closeSelected = useEventCallback(() => setSelectedId(null));
  const markSelectedRead = useEventCallback(() => {
    if (selected === undefined || selected.readAt !== null) return;
    setReadOverrides((current) => new Set(current).add(selected.notification.id));
    markRead.mutate({ payload: { notificationId: selected.notification.id } });
  });
  const markEveryNotificationRead = useEventCallback(() => {
    setAllReadOverride(true);
    markAllRead.mutate();
  });
  const archiveSelected = useEventCallback(() => {
    if (selected === undefined) return;
    const notificationId = selected.notification.id;
    setArchivedOverrides((current) => new Set(current).add(notificationId));
    setSelectedId(null);
    archive.mutate({ payload: { notificationId } });
  });
  const loadMore = useEventCallback(() => {
    if (nextCursor === null || nextCursor === undefined) return;
    setAdditionalCursors((current) =>
      current.includes(nextCursor) ? current : [...current, nextCursor],
    );
  });

  return (
    <DashboardPage>
      {additionalCursors.map((cursor) => (
        <NotificationPageLoader cursor={cursor} key={cursor} onData={handleAdditionalPage} />
      ))}

      <div className="grid h-[calc(100dvh-1rem)] min-h-0 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside
          className={
            selected === undefined
              ? "flex min-h-0 flex-col border-r"
              : "hidden min-h-0 flex-col border-r lg:flex"
          }
        >
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
            <Sidebar.Trigger />
            <HeadingGroup.Title className="text-sm" level={1} weight="normal">
              Inbox
            </HeadingGroup.Title>
            <span className="ml-1 text-xs tabular-nums text-muted">
              {unreadCount === 0 ? null : unreadCount}
            </span>

            <div className="ml-auto flex items-center gap-1">
              <TableFilterControl
                ariaLabel="Filter notifications"
                facets={filterFacets}
                onClear={clearFilters}
              />
              <Tooltip delay={300}>
                <Tooltip.Trigger>
                  <Button
                    isIconOnly
                    aria-label="Mark all notifications as read"
                    isDisabled={unreadCount === 0 || markAllRead.isPending}
                    size="sm"
                    variant="tertiary"
                    onPress={markEveryNotificationRead}
                  >
                    {markAllRead.isPending ? (
                      <Spinner className="size-4" />
                    ) : (
                      <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                    )}
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content showArrow>
                  <Tooltip.Arrow />
                  Mark all as read
                </Tooltip.Content>
              </Tooltip>
            </div>
          </header>

          <div className="shrink-0 border-b p-3">
            <SearchField
              aria-label="Search notifications"
              className="w-full"
              value={query}
              onChange={setQuery}
            >
              <SearchField.Group>
                <SearchField.SearchIcon />
                <SearchField.Input placeholder="Search inbox…" />
                <SearchField.ClearButton aria-label="Clear notification search" />
              </SearchField.Group>
            </SearchField>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-2">
            {firstPage.isLoading ? (
              <DataLoading className="min-h-72" label="Loading notifications" />
            ) : firstPage.isError ? (
              <div className="px-5 py-10 text-center">
                <Typography className="text-sm! text-danger" weight="medium">
                  Couldn’t load notifications
                </Typography>
                <Typography className="mt-1 text-xs!" color="muted">
                  Refresh the page to try again.
                </Typography>
              </div>
            ) : (
              <NotificationList
                canLoadMore={nextCursor !== null && nextCursor !== undefined}
                isLoadingMore={isLoadingMore}
                items={filteredItems}
                selectedId={selectedId}
                onLoadMore={loadMore}
                onSelect={selectNotification}
              />
            )}
          </div>
        </aside>

        <main
          className={
            selected === undefined ? "hidden min-h-0 lg:flex lg:flex-col" : "flex min-h-0 flex-col"
          }
        >
          {selected === undefined ? (
            <NotificationEmptyDetail />
          ) : (
            <>
              <DetailToolbar
                canMarkRead={selected.readAt === null}
                onArchive={archiveSelected}
                onBack={closeSelected}
                onMarkRead={markSelectedRead}
              />
              <div className="min-h-0 flex-1 overflow-y-auto">
                <NotificationDetail item={selected} />
              </div>
            </>
          )}
        </main>
      </div>
    </DashboardPage>
  );
}
