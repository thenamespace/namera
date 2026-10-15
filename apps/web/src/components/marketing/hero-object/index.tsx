import { useId, useState } from "react";

import {
  CheckmarkCircle02Icon,
  Icon,
  MoreHorizontalIcon,
  NameraIcon,
  PanelLeftIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  PreferenceHorizontalIcon,
  Search01Icon,
} from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { AccountsPanel, ActivityPanel } from "./account-panels";
import { NAV, SECTIONS, SWITCHABLE, TABS, type Section, type Tab } from "./data";
import { IconChip } from "./display";
import { InboxPanel } from "./inbox-panel";
import { HomePanel } from "./overview-panel";
import { OverviewPanel, PoliciesPanel, UsagePanel } from "./session-key-panels";

export const HeroObject = () => {
  const [section, setSection] = useState<Section>("Overview");
  const [tab, setTab] = useState<Tab>("Policies");
  const tabsId = useId();

  const breadcrumb = section === "Session Keys" ? ["Session Keys", "Uniswap Agent"] : [section];

  return (
    <div
      className={cn(
        "edge-top relative flex overflow-hidden rounded-lg border-1 border-hairline-strong",
        "h-auto md:min-h-[44rem]",
        "[background:var(--marketing-panel-gradient)]",
      )}
    >
      <nav
        aria-label="Namera dashboard preview"
        className="hidden w-[176px] shrink-0 flex-col gap-4 p-3 md:flex lg:w-[200px]"
      >
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            aria-hidden
            className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-default/80"
          >
            <NameraIcon fill="currentColor" className="h-1.5 w-auto text-foreground" />
          </span>
          <span className="text-[0.75rem] font-medium text-foreground">Personal</span>
          <svg viewBox="0 0 12 12" className="size-3 text-ink-subtle" aria-hidden>
            <path
              d="M3 4.5 6 7.5 9 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="ml-auto flex items-center gap-1.5 text-ink-subtle">
            <Icon icon={Search01Icon} aria-hidden strokeWidth={1.7} className="size-3.5" />
            <Icon icon={PencilEdit02Icon} aria-hidden strokeWidth={1.7} className="size-3.5" />
          </span>
        </div>

        {NAV.map((group) => (
          <div key={group.group} className="flex flex-col gap-0.5">
            <p className="px-2 pb-1 text-[0.625rem] font-medium text-ink-subtle">{group.group}</p>
            {group.items.map((item) => {
              const selectable = SWITCHABLE.has(item.label);
              const active = selectable && item.label === section;
              return (
                <button
                  key={item.label}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (selectable) setSection(item.label as Section);
                  }}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[0.75rem]",
                    "transition-colors duration-150 ease-out-quad",
                    "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                    selectable ? "cursor-pointer" : "cursor-default",
                    active ? "bg-default/80 text-foreground" : "text-ink-subtle",
                    !active && selectable && "hover:bg-default/40 hover:text-muted",
                  )}
                >
                  <Icon
                    icon={item.icon}
                    aria-hidden
                    strokeWidth={1.7}
                    className="size-3.5 shrink-0"
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="flex min-w-0 flex-1 flex-col border-l-1 border-border bg-canvas/40 md:m-2 md:ml-0 md:rounded-md md:border-1">
        <div className="flex h-11 shrink-0 items-center gap-2 border-b-1 border-border px-4 text-[0.75rem]">
          <Icon
            icon={PanelLeftIcon}
            aria-hidden
            strokeWidth={1.7}
            className="mr-1 size-3.5 shrink-0 text-ink-subtle"
          />
          {breadcrumb.map((crumb, index) => (
            <span key={crumb} className="flex items-center gap-2">
              {index > 0 ? (
                <span aria-hidden className="text-separator">
                  /
                </span>
              ) : null}
              <span
                className={index === breadcrumb.length - 1 ? "text-foreground" : "text-ink-subtle"}
              >
                {crumb}
              </span>
            </span>
          ))}
          {section === "Inbox" ? (
            <span className="ml-3 flex items-center gap-2">
              <IconChip icon={PreferenceHorizontalIcon} />
              <IconChip icon={CheckmarkCircle02Icon} />
            </span>
          ) : null}
          <span
            aria-hidden
            className="ml-auto grid size-6 place-items-center rounded-md text-ink-subtle"
          >
            <Icon
              icon={section === "Accounts" ? PlusSignIcon : MoreHorizontalIcon}
              strokeWidth={2}
              className="size-3.5"
            />
          </span>
        </div>

        {/* The sidebar is hidden on a phone, so the sections move to a rail. */}
        <div
          className={cn(
            "flex shrink-0 gap-1 overflow-x-auto border-b-1 border-border px-3 py-2 md:hidden",
            "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {SECTIONS.map((item) => {
            const active = item === section;
            return (
              <button
                key={item}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setSection(item);
                }}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1.5 text-[0.75rem] whitespace-nowrap",
                  "transition-colors duration-150 ease-out-quad",
                  "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                  active ? "bg-default/80 text-foreground" : "text-ink-subtle",
                )}
              >
                {item}
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 overflow-x-hidden px-4 pt-3 pb-5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
          {section === "Session Keys" ? (
            <div className="flex">
              <div className="min-w-0 flex-1">
                <div role="tablist" aria-label="Session key" className="flex items-center gap-1">
                  {TABS.map((item) => {
                    const active = item === tab;
                    return (
                      <button
                        key={item}
                        type="button"
                        role="tab"
                        id={`${tabsId}-${item}`}
                        aria-selected={active}
                        aria-controls={`${tabsId}-panel`}
                        onClick={() => {
                          setTab(item);
                        }}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-[0.75rem]",
                          "transition-colors duration-150 ease-out-quad",
                          "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
                          active
                            ? "bg-default/80 text-foreground"
                            : "text-ink-subtle hover:text-muted",
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <div
                  id={`${tabsId}-panel`}
                  role="tabpanel"
                  aria-labelledby={`${tabsId}-${tab}`}
                  className={cn("mt-6", tab === "Usage" ? "max-w-none" : "max-w-[30rem]")}
                >
                  {tab === "Overview" ? <OverviewPanel /> : null}
                  {tab === "Policies" ? <PoliciesPanel /> : null}
                  {tab === "Usage" ? <UsagePanel /> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className={section === "Inbox" ? "h-full" : "mt-3"}>
              {section === "Overview" ? <HomePanel /> : null}
              {section === "Inbox" ? <InboxPanel /> : null}
              {section === "Accounts" ? <AccountsPanel /> : null}
              {section === "Activity" ? <ActivityPanel /> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
