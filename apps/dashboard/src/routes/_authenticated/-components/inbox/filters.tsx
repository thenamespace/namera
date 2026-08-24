import { useMemo, useState } from "react";

import { DateTime } from "effect";

import type { NotificationResponse } from "@namera-ai/protocol/dto";
import type { NotificationType } from "@namera-ai/protocol/model";
import { type DataGridSelection } from "@namera-ai/ui";
import {
  ArrowUpDownIcon,
  Building03Icon,
  Calendar03Icon,
  Clock01Icon,
  HugeiconsIcon,
  InboxIcon,
  NotificationSquareIcon,
  Sorting05Icon,
  UserIcon,
} from "@namera-ai/ui/icons";
import { useEventCallback } from "usehooks-ts";

import { toTableSelection, type TableFilterFacet } from "@/components/common/table";

import {
  inboxGroupOptions,
  notificationPresentation,
  notificationSearchText,
  type InboxNotificationGroup,
} from "./data";
import { NotificationIcon } from "./notification-icon";

type InboxDateRange = "1d" | "7d" | "30d" | "all";
type InboxOrder = "newest" | "oldest";
type InboxScope = "organization" | "user";
type InboxStatus = "read" | "unread";

const millisecondsPerDay = 86_400_000;
const defaultDateRanges: ReadonlySet<string> = new Set(["7d"]);
const defaultOrder: ReadonlySet<string> = new Set(["newest"]);

const statusOptions = [
  { id: "unread", label: "Unread" },
  { id: "read", label: "Read" },
] as const;

const scopeOptions = [
  { id: "organization", label: "Organization", icon: Building03Icon },
  { id: "user", label: "User", icon: UserIcon },
] as const;

const dateRangeOptions = [
  { id: "1d", label: "Last 24 hours", days: 1 },
  { id: "7d", label: "Last 7 days", days: 7 },
  { id: "30d", label: "Last 30 days", days: 30 },
  { id: "all", label: "All time", days: null },
] as const;

const orderOptions = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
] as const;

const notificationTypeOptions = (
  Object.keys(notificationPresentation) as ReadonlyArray<NotificationType>
).map((type) => ({ id: type, label: notificationPresentation[type].title }));

function singleSelection<Key extends string>(
  selection: DataGridSelection,
  availableKeys: ReadonlyArray<Key>,
  fallback: Key,
): Set<Key> {
  const selected = toTableSelection(selection, availableKeys);
  const first = selected.values().next().value;
  return new Set([first ?? fallback]);
}

function notificationScope(item: NotificationResponse): InboxScope {
  return item.notification.organizationId === null ? "user" : "organization";
}

export function useInboxFilters(items: ReadonlyArray<NotificationResponse>) {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<ReadonlySet<InboxStatus>>(new Set());
  const [groups, setGroups] = useState<ReadonlySet<InboxNotificationGroup>>(new Set());
  const [scopes, setScopes] = useState<ReadonlySet<InboxScope>>(new Set());
  const [types, setTypes] = useState<ReadonlySet<NotificationType>>(new Set());
  const [dateRanges, setDateRanges] = useState<ReadonlySet<InboxDateRange>>(() => new Set(["7d"]));
  const [orders, setOrders] = useState<ReadonlySet<InboxOrder>>(() => new Set(["newest"]));

  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    const dateRange = dateRanges.values().next().value ?? "7d";
    const order = orders.values().next().value ?? "newest";
    const days = dateRangeOptions.find((option) => option.id === dateRange)?.days ?? 7;
    const cutoff = days === null ? null : Date.now() - days * millisecondsPerDay;
    const visible: Array<NotificationResponse> = [];

    for (const item of items) {
      const status: InboxStatus = item.readAt === null ? "unread" : "read";
      const group = notificationPresentation[item.notification.type].group;
      const scope = notificationScope(item);
      const receivedAt = DateTime.toEpochMillis(item.receivedAt);

      if (normalizedQuery.length > 0 && !notificationSearchText(item).includes(normalizedQuery)) {
        continue;
      }
      if (statuses.size > 0 && !statuses.has(status)) continue;
      if (groups.size > 0 && !groups.has(group)) continue;
      if (scopes.size > 0 && !scopes.has(scope)) continue;
      if (types.size > 0 && !types.has(item.notification.type)) continue;
      if (cutoff !== null && receivedAt < cutoff) continue;

      visible.push(item);
    }

    visible.sort((left, right) => {
      const difference =
        DateTime.toEpochMillis(right.receivedAt) - DateTime.toEpochMillis(left.receivedAt);
      return order === "newest" ? difference : -difference;
    });
    return visible;
  }, [dateRanges, groups, items, normalizedQuery, orders, scopes, statuses, types]);

  const filterFacets = useMemo<ReadonlyArray<TableFilterFacet>>(() => {
    const statusCounts = new Map<InboxStatus, number>();
    const groupCounts = new Map<InboxNotificationGroup, number>();
    const scopeCounts = new Map<InboxScope, number>();
    const typeCounts = new Map<NotificationType, number>();

    for (const item of items) {
      const status: InboxStatus = item.readAt === null ? "unread" : "read";
      const group = notificationPresentation[item.notification.type].group;
      const scope = notificationScope(item);
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
      groupCounts.set(group, (groupCounts.get(group) ?? 0) + 1);
      scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1);
      typeCounts.set(item.notification.type, (typeCounts.get(item.notification.type) ?? 0) + 1);
    }

    return [
      {
        id: "order",
        label: "Order",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Sorting05Icon} />,
        selectionMode: "single",
        disallowEmptySelection: true,
        defaultSelectedKeys: defaultOrder,
        selectedKeys: orders,
        options: orderOptions.map((option) => ({
          ...option,
          content: (
            <span className="flex items-center gap-2 text-sm">
              <HugeiconsIcon className="size-4 text-muted" icon={ArrowUpDownIcon} />
              {option.label}
            </span>
          ),
        })),
        onSelectionChange: (selection: DataGridSelection) =>
          setOrders(
            singleSelection(
              selection,
              orderOptions.map(({ id }) => id),
              "newest",
            ),
          ),
      },
      {
        id: "date",
        label: "Date",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Calendar03Icon} />,
        selectionMode: "single",
        disallowEmptySelection: true,
        defaultSelectedKeys: defaultDateRanges,
        selectedKeys: dateRanges,
        options: dateRangeOptions.map((option) => ({
          id: option.id,
          label: option.label,
          content: (
            <span className="flex items-center gap-2 text-sm">
              <HugeiconsIcon className="size-4 text-muted" icon={Clock01Icon} />
              {option.label}
            </span>
          ),
        })),
        onSelectionChange: (selection: DataGridSelection) =>
          setDateRanges(
            singleSelection(
              selection,
              dateRangeOptions.map(({ id }) => id),
              "7d",
            ),
          ),
      },
      {
        id: "status",
        label: "Status",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={NotificationSquareIcon} />,
        selectedKeys: statuses,
        options: statusOptions.map((option) => ({
          ...option,
          count: statusCounts.get(option.id) ?? 0,
          content: (
            <span className="flex items-center gap-2 text-sm">
              <span
                className={
                  option.id === "unread"
                    ? "size-2 rounded-full bg-accent"
                    : "size-2 rounded-full border border-muted"
                }
              />
              {option.label}
            </span>
          ),
        })),
        onSelectionChange: (selection: DataGridSelection) =>
          setStatuses(
            toTableSelection(
              selection,
              statusOptions.map(({ id }) => id),
            ),
          ),
      },
      {
        id: "scope",
        label: "For",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={Building03Icon} />,
        selectedKeys: scopes,
        options: scopeOptions.map((option) => ({
          id: option.id,
          label: option.label,
          count: scopeCounts.get(option.id) ?? 0,
          content: (
            <span className="flex items-center gap-2 text-sm">
              <span className="grid size-6 place-items-center rounded-md bg-accent/10 text-accent">
                <HugeiconsIcon className="size-3.5" icon={option.icon} />
              </span>
              {option.label}
            </span>
          ),
        })),
        onSelectionChange: (selection: DataGridSelection) =>
          setScopes(
            toTableSelection(
              selection,
              scopeOptions.map(({ id }) => id),
            ),
          ),
      },
      {
        id: "category",
        label: "Category",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={InboxIcon} />,
        selectedKeys: groups,
        options: inboxGroupOptions.map((option) => ({
          id: option.id,
          label: option.label,
          count: groupCounts.get(option.id) ?? 0,
          content: (
            <span className="flex items-center gap-2 text-sm">
              <HugeiconsIcon className="size-4 text-muted" icon={option.icon} />
              {option.label}
            </span>
          ),
        })),
        onSelectionChange: (selection: DataGridSelection) =>
          setGroups(
            toTableSelection(
              selection,
              inboxGroupOptions.map(({ id }) => id),
            ),
          ),
      },
      {
        id: "type",
        label: "Notification type",
        icon: <HugeiconsIcon className="size-4 text-muted" icon={NotificationSquareIcon} />,
        selectedKeys: types,
        options: notificationTypeOptions.map((option) => ({
          ...option,
          count: typeCounts.get(option.id) ?? 0,
          content: (
            <span className="flex items-center gap-2 text-sm">
              <NotificationIcon
                className="size-6 rounded-md"
                iconClassName="size-3.5"
                type={option.id}
              />
              {option.label}
            </span>
          ),
        })),
        onSelectionChange: (selection: DataGridSelection) =>
          setTypes(
            toTableSelection(
              selection,
              notificationTypeOptions.map(({ id }) => id),
            ),
          ),
      },
    ];
  }, [dateRanges, groups, items, orders, scopes, statuses, types]);

  const clearFilters = useEventCallback(() => {
    setStatuses(new Set());
    setGroups(new Set());
    setScopes(new Set());
    setTypes(new Set());
    setDateRanges(new Set(["7d"]));
    setOrders(new Set(["newest"]));
  });

  return { clearFilters, filteredItems, filterFacets, query, setQuery } as const;
}
