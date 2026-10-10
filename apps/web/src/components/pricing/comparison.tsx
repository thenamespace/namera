import { useState } from "react";

import { Icon, InformationCircleIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { ActionAnchor, Reveal } from "#/components/marketing/primitives";
import { SITE_LINKS } from "#/lib/site-links";

import { Check } from "./check";
import { GROUPS, PLANS, type PlanId } from "./plans";

/*
 * One table, two shapes. Wide enough and every plan is a column, which is the
 * only way to compare them, and the header row stays put while the rows scroll
 * under it. On a phone the reader picks one plan and reads it down instead.
 *
 * What a row means lives behind an info mark rather than under the label: the
 * page was carrying three lines of explanation per row and reading like a
 * manual. The mark appears when the row is hovered or the button is focused.
 */

const Value = ({ value }: { readonly value: string }) => {
  if (value === "Yes") {
    return (
      <>
        <Check />
        <span className="sr-only">Included</span>
      </>
    );
  }
  return (
    <span
      className={cn(
        "text-[0.875rem]",
        value === "Stops at the limit" ? "text-ink-subtle" : "text-foreground",
      )}
    >
      {value}
    </span>
  );
};

const RowLabel = ({ label, note }: { readonly label: string; readonly note?: string }) => (
  <span className="flex items-center gap-2">
    <span className="text-[0.875rem] text-muted">{label}</span>
    {note === undefined ? null : (
      <span className="group/tip relative inline-flex">
        <button
          type="button"
          aria-label={`What ${label.toLowerCase()} means`}
          className={cn(
            "grid size-5 place-items-center rounded-full text-ink-subtle opacity-0",
            "transition-opacity duration-150 ease-out-quad",
            "group-hover/row:opacity-100 hover:text-muted focus-visible:opacity-100",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus/60",
          )}
        >
          <Icon icon={InformationCircleIcon} aria-hidden strokeWidth={1.7} className="size-3.5" />
        </button>
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-[16rem] -translate-x-1/2",
            "edge-top rounded-lg border-1 border-hairline-strong bg-elevated px-3 py-2",
            "text-[0.75rem] text-pretty text-muted opacity-0",
            "transition-opacity duration-150 ease-out-quad",
            "group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          )}
        >
          {note}
        </span>
      </span>
    )}
  </span>
);

const Action = ({ planId }: { readonly planId: PlanId }) => {
  const plan = PLANS.find((item) => item.id === planId);
  if (plan === undefined) return null;
  if (plan.action === "waitlist") {
    return (
      <ActionAnchor href="/#waitlist" variant="light" className="h-10 w-full justify-center">
        Join the waitlist
      </ActionAnchor>
    );
  }
  if (plan.action === "contact" && SITE_LINKS.contact !== null) {
    return (
      <ActionAnchor
        href={SITE_LINKS.contact}
        variant="secondary"
        className="h-10 w-full justify-center"
      >
        Talk to us
      </ActionAnchor>
    );
  }
  return (
    <span className="flex h-10 w-full items-center justify-center rounded-lg border-1 border-border text-[0.8125rem] text-ink-subtle">
      Coming soon
    </span>
  );
};

export const Comparison = () => {
  const [plan, setPlan] = useState<PlanId>("free");

  return (
    <Reveal>
      <div className="mb-8 flex items-center gap-1 rounded-lg border-1 border-border p-1 lg:hidden">
        {PLANS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={item.id === plan}
            onClick={() => {
              setPlan(item.id);
            }}
            className={cn(
              "tap-target flex-1 rounded-md px-2 py-2 text-[0.8125rem]",
              "transition-colors duration-150 ease-out-quad",
              "focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-focus/60",
              item.id === plan ? "bg-default/80 text-foreground" : "text-ink-subtle",
            )}
          >
            {item.name}
          </button>
        ))}
      </div>

      <table className="w-[calc(100%+1.5rem)] -mx-3 border-separate border-spacing-0 text-left">
        <caption className="sr-only">Allowances and limits by plan</caption>

        <thead className="sticky top-14 z-10 bg-background">
          <tr>
            <th
              scope="col"
              className="w-[34%] border-b-1 border-border py-4 pr-6 pl-3 text-left text-[1rem] font-medium tracking-[-0.02em] text-foreground"
            >
              Features
            </th>
            {PLANS.map((item) => (
              <th
                key={item.id}
                scope="col"
                className={cn(
                  "w-[16.5%] border-b-1 border-border py-4 pr-6 last:pr-3",
                  "text-[1rem] font-medium tracking-[-0.02em] text-foreground",
                  item.id === plan ? "" : "hidden",
                  "lg:table-cell",
                )}
              >
                {item.name}
              </th>
            ))}
          </tr>
        </thead>

        {GROUPS.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th scope="colgroup" colSpan={PLANS.length + 1} className="pt-12 pb-4 pl-3 text-left">
                <span className="text-[0.9375rem] font-medium tracking-[-0.015em] text-foreground">
                  {group.title}
                </span>
                {group.note ? (
                  <p className="mt-2 max-w-2xl text-sm font-normal text-muted">{group.note}</p>
                ) : null}
              </th>
            </tr>

            {group.rows.map((row) => {
              const values = PLANS.map((item) => row.values[item.id]);
              const uniform = values.every((value) => value === values[0]);
              return (
                <tr
                  key={row.label}
                  className={cn(
                    "group/row",
                    "[&>*]:border-t-1 [&>*]:border-border/60",
                    "[&>*]:transition-colors [&>*]:duration-150 [&>*]:ease-out-quad",
                    "hover:[&>*]:bg-surface/70",
                    "[&>*:first-child]:rounded-l-lg [&>*:last-child]:rounded-r-lg",
                  )}
                >
                  <th scope="row" className="py-3.5 pr-6 pl-3 text-left font-normal">
                    <RowLabel
                      label={row.label}
                      {...(row.note === undefined ? {} : { note: row.note })}
                    />
                  </th>
                  {uniform ? (
                    <td colSpan={PLANS.length} className="py-3.5 pr-3">
                      <Value value={values[0] ?? ""} />
                    </td>
                  ) : (
                    PLANS.map((item) => (
                      <td
                        key={item.id}
                        className={cn(
                          "py-3.5 pr-6 last:pr-3",
                          item.id === plan ? "" : "hidden",
                          "lg:table-cell",
                        )}
                      >
                        <Value value={row.values[item.id]} />
                      </td>
                    ))
                  )}
                </tr>
              );
            })}
          </tbody>
        ))}

        {/* the actions again, so nobody has to scroll back up to act */}
        <tfoot>
          <tr>
            <th scope="row" className="pt-12 pr-6 pl-3">
              <span className="sr-only">Choose a plan</span>
            </th>
            {PLANS.map((item) => (
              <td
                key={item.id}
                className={cn(
                  "pt-12 pr-6 last:pr-3",
                  item.id === plan ? "" : "hidden",
                  "lg:table-cell",
                )}
              >
                <Action planId={item.id} />
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </Reveal>
  );
};
