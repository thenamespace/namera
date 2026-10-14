import {
  CheckmarkCircle02Icon,
  Icon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  PreferenceHorizontalIcon,
  Search01Icon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

export const IconChip = ({ icon }: { readonly icon: typeof Search01Icon }) => (
  <span
    aria-hidden
    className="grid size-7 shrink-0 place-items-center rounded-full border-1 border-border bg-surface/60 text-ink-subtle"
  >
    <Icon icon={icon} strokeWidth={1.7} className="size-3.5" />
  </span>
);

export const Toolbar = ({ placeholder }: { readonly placeholder: string }) => (
  <div className="flex items-center gap-2">
    <div
      aria-hidden
      className="flex h-8 w-full max-w-[19rem] items-center gap-2 rounded-lg border-1 border-border bg-surface/50 px-2.5"
    >
      <Icon icon={Search01Icon} strokeWidth={1.7} className="size-3.5 text-ink-subtle" />
      <span className="truncate text-[0.75rem] text-ink-subtle">{placeholder}</span>
    </div>
    <span className="ml-auto flex items-center gap-2">
      <IconChip icon={PreferenceHorizontalIcon} />
      <IconChip icon={PanelLeftIcon} />
    </span>
  </div>
);

export type Column = { readonly label: string; readonly className?: string };

export const Table = ({
  columns,
  children,
}: {
  readonly columns: readonly Column[];
  readonly children: React.ReactNode;
}) => (
  <table className="w-full table-fixed border-collapse text-left">
    <thead>
      <tr className="border-y-1 border-border">
        {columns.map((column) => (
          <th
            key={column.label}
            scope="col"
            className={cn(
              "truncate border-l-1 border-border px-3 py-2 text-[0.6875rem] font-normal text-ink-subtle first:border-l-0",
              column.className,
            )}
          >
            {column.label}
          </th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

export const Td = ({
  children,
  className,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
}) => (
  <td
    className={cn(
      "truncate border-b-1 border-border px-3 py-3 text-[0.8125rem] text-foreground",
      className,
    )}
  >
    {children}
  </td>
);

export const StatusCell = ({ status }: { readonly status: string }) => {
  const blocked = status === "Blocked";
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-[0.8125rem]",
        blocked ? "text-danger" : "text-success",
      )}
    >
      <Icon
        icon={blocked ? MoreHorizontalIcon : CheckmarkCircle02Icon}
        aria-hidden
        strokeWidth={1.8}
        className={cn("size-3.5", blocked && "hidden")}
      />
      {blocked ? <span aria-hidden className="size-1.5 rounded-full bg-danger" /> : null}
      {status}
    </span>
  );
};

export const Emoji = ({ children }: { readonly children: React.ReactNode }) => (
  <span
    aria-hidden
    className="grid size-5 shrink-0 place-items-center rounded-md bg-default/70 text-[0.6875rem]"
  >
    {children}
  </span>
);

export const Meter = ({
  label,
  used,
  of,
  fill,
}: {
  readonly label: string;
  readonly used: string;
  readonly of: string;
  readonly fill: number;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[0.75rem] text-ink-subtle">{label}</span>
      <span className="text-[0.75rem] tabular-nums text-foreground">
        {used}
        <span className="text-ink-subtle"> of {of}</span>
      </span>
    </div>
    <div className="h-1.5 overflow-hidden rounded-full bg-default">
      <div className="h-full rounded-full bg-accent" style={{ width: `${String(fill)}%` }} />
    </div>
  </div>
);

export const Row = ({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}) => (
  <div className="flex items-start gap-4 border-t-1 border-border py-2.5">
    <dt className="w-28 shrink-0 text-[0.75rem] text-ink-subtle">{label}</dt>
    <dd className="flex min-w-0 items-center gap-1.5 text-[0.75rem] text-foreground">{children}</dd>
  </div>
);
