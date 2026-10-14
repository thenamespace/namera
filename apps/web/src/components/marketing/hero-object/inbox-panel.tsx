import { useState } from "react";

import { Copy01Icon, Icon, Search01Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { INBOX } from "./data";

export const InboxPanel = () => {
  const [openId, setOpenId] = useState<string>(INBOX[0].id);
  const open = INBOX.find((item) => item.id === openId) ?? INBOX[0];

  return (
    <div className="-mx-4 -mt-3 flex h-full sm:-mx-6">
      <div className="w-full shrink-0 border-border px-3 lg:w-[18rem] lg:border-r-1">
        <div
          aria-hidden
          className="mt-1 flex h-8 items-center gap-2 rounded-lg border-1 border-border bg-surface/50 px-2.5"
        >
          <Icon icon={Search01Icon} strokeWidth={1.7} className="size-3.5 text-ink-subtle" />
          <span className="text-[0.75rem] text-ink-subtle">Search inbox…</span>
        </div>

        <ul className="mt-2 flex flex-col">
          {INBOX.map((item) => {
            const active = item.id === open.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpenId(item.id);
                  }}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left",
                    "transition-colors duration-150 ease-out-quad",
                    "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus/60",
                    active ? "bg-default/60" : "hover:bg-default/30",
                  )}
                >
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-default/70 text-ink-subtle"
                  >
                    <Icon icon={item.icon} strokeWidth={1.7} className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">
                        {item.title}
                      </span>
                      <span className="shrink-0 text-[0.625rem] text-ink-subtle">{item.when}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.6875rem] text-ink-subtle">
                      {item.preview}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="hidden min-w-0 flex-1 px-8 pt-8 lg:block">
        <div className="mx-auto max-w-[32rem]">
          <div className="flex items-center gap-3.5">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-default/70 text-muted"
            >
              <Icon icon={open.icon} strokeWidth={1.6} className="size-4.5" />
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-[1.125rem] font-medium tracking-[-0.015em] text-foreground">
                {open.heading}
              </h2>
              <p className="mt-1 text-[0.6875rem] text-ink-subtle">{open.at}</p>
            </div>
          </div>

          <p className="mt-6 text-[0.8125rem] leading-relaxed text-muted">{open.body}</p>

          <dl className="mt-6 overflow-hidden rounded-xl border-1 border-border bg-surface/40">
            {open.facts.map(([label, value], index) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-4 px-4 py-3",
                  index > 0 && "border-t-1 border-border",
                )}
              >
                <dt className="w-32 shrink-0 text-[0.75rem] text-ink-subtle">{label}</dt>
                <dd className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-foreground">
                  <span className="truncate">{value}</span>
                  {label.endsWith("ID") ? (
                    <Icon
                      icon={Copy01Icon}
                      aria-hidden
                      strokeWidth={1.7}
                      className="size-3.5 shrink-0 text-ink-subtle"
                    />
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          <span className="mt-5 inline-flex items-center rounded-lg border-1 border-border bg-default/60 px-3 py-1.5 text-[0.75rem] text-foreground">
            {open.action}
          </span>
        </div>
      </div>
    </div>
  );
};
