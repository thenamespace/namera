import { cn } from "@namera-ai/ui/utils";

import { ActionAnchor, Reveal } from "#/components/marketing/primitives";
import { SITE_LINKS } from "#/lib/site-links";

import { Check } from "./check";
import { PLANS } from "./plans";

/*
 * Columns divided by hairlines rather than boxed in cards, two rules inside
 * each one, and the actions aligned along the bottom whatever the lists above
 * them do. The buttons keep this site's 8px radius rather than the reference's
 * pill, because every other button on the site is 8px (DESIGN.md).
 */
export const PlanCards = () => (
  <div
    className={cn(
      "grid grid-cols-1 divide-y-1 divide-border",
      "lg:grid-cols-4 lg:divide-x-1 lg:divide-y-0",
    )}
  >
    {PLANS.map((plan, index) => (
      <Reveal
        key={plan.id}
        delay={index * 0.05}
        className={
          cn("flex py-10 first:pt-0 last:pb-0", "lg:px-9 lg:py-0 lg:first:pl-0 lg:last:pr-0") ?? ""
        }
      >
        <div className="flex w-full flex-col">
          <h2 className="text-[1.375rem] font-medium tracking-[-0.024em] text-foreground">
            {plan.name}
          </h2>

          <p className="mt-2.5 flex items-baseline gap-1.5">
            <span className="text-[1.25rem] tracking-[-0.02em] text-foreground">{plan.price}</span>
            {plan.cadence === undefined ? null : (
              <span className="text-[0.9375rem] text-ink-subtle">{plan.cadence}</span>
            )}
          </p>

          <p
            className={cn(
              "mt-6 border-t-1 border-border py-5 text-[0.875rem]",
              plan.available ? "text-muted" : "text-ink-subtle",
            )}
          >
            {plan.summary}
          </p>

          <ul className="flex flex-col gap-3.5 border-t-1 border-border pt-7">
            {plan.features.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-px" />
                <span className="text-[0.9375rem] leading-[1.35] text-muted">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-12">
            {plan.action === "waitlist" ? (
              <ActionAnchor
                href="/#waitlist"
                variant="light"
                className="h-11 w-full justify-center text-[0.9375rem]"
              >
                Join the waitlist
              </ActionAnchor>
            ) : plan.action === "contact" && SITE_LINKS.contact !== null ? (
              <ActionAnchor
                href={SITE_LINKS.contact}
                variant="secondary"
                className="h-11 w-full justify-center text-[0.9375rem]"
              >
                Talk to us
              </ActionAnchor>
            ) : (
              <p className="flex h-11 w-full items-center justify-center rounded-lg border-1 border-border text-[0.9375rem] text-ink-subtle">
                Coming soon
              </p>
            )}
          </div>
        </div>
      </Reveal>
    ))}
  </div>
);
