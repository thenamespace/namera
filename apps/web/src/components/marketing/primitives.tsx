import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "@namera-ai/ui/utils";

/* -------------------------------------------------------------------------
 * Layout
 * ---------------------------------------------------------------------- */

/**
 * The content column. `rails` draws the faded vertical hairlines that mark the
 * column edges; sections that own a full-bleed visual opt out.
 */
export const Container = ({
  children,
  className,
  rails = false,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly rails?: boolean;
}) => (
  <div className={cn("relative mx-auto w-full max-w-[1440px] px-6 md:px-10 lg:px-14", className)}>
    {rails ? (
      <>
        <span aria-hidden className="rail left-6 md:left-10" />
        <span aria-hidden className="rail right-6 md:right-10" />
      </>
    ) : null}
    {children}
  </div>
);

export const Section = ({
  children,
  className,
  id,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
}) => (
  <section
    id={id}
    // Anchored sections clear the fixed header when jumped to by hash.
    className={cn("relative scroll-mt-14 py-24 md:py-36 lg:py-44", className)}
  >
    {children}
  </section>
);

/* -------------------------------------------------------------------------
 * Motion
 * ---------------------------------------------------------------------- */

/*
 * Scroll reveal.
 *
 * Presentation only: the animation is a scroll-driven CSS animation defined in
 * marketing.css, so these are plain elements with a class. Nothing here hides
 * content, and nothing depends on a script having run.
 */
export const Reveal = ({
  children,
  className,
  delay = 0,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  /** Seconds of extra lead-in, to stagger a reveal against its neighbour. */
  readonly delay?: number;
}) => (
  <div
    className={cn("reveal-init", className)}
    style={delay > 0 ? { animationDelay: `${String(delay * 1000)}ms` } : undefined}
  >
    {children}
  </div>
);

/* -------------------------------------------------------------------------
 * Controls
 *
 * Marketing buttons are intentionally hand-rolled rather than reusing the
 * product `Button`. The product control carries app affordances (loading
 * state, icon slots, pressable feedback) that a landing page does not need,
 * and its sizing is tuned for dense UI rather than a hero.
 * ---------------------------------------------------------------------- */

const ACTION_BASE = cn(
  // `tap-target` lifts the hit box to 44px on touch input at any width; the
  // drawn height stays 36px, where a cursor is pixel-accurate (R-03).
  "tap-target group/btn inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5",
  "text-sm font-medium whitespace-nowrap select-none",
  "transition-[background-color,border-color,color,filter,transform] duration-150 ease-out-quad",
  "active:scale-[0.975]",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
);

const ACTION_VARIANTS = {
  /** Accent as a FILL is fine; accent as text is not (R-25). */
  primary: "bg-accent text-accent-foreground hover:brightness-[1.18]",
  light: "bg-[#e9eaec] text-[#101113] hover:bg-white",
  secondary:
    "border-1 border-border bg-surface/70 text-foreground hover:border-hairline-strong hover:bg-elevated",
  ghost: "text-muted hover:bg-default/60 hover:text-foreground",
} as const;

export type ActionVariant = keyof typeof ACTION_VARIANTS;

/**
 * Button styling as a class string rather than a wrapper component, so a
 * router `Link` can carry it without re-declaring the router's generic
 * route/params typing at every call site.
 */
const actionClass = (variant: ActionVariant = "primary", className?: string) =>
  cn(ACTION_BASE, ACTION_VARIANTS[variant], className);

/** External navigation styled as a button. */
export const ActionAnchor = ({
  children,
  variant = "primary",
  className,
  ...rest
}: {
  readonly children: ReactNode;
  readonly variant?: ActionVariant;
  readonly className?: string;
} & ComponentPropsWithoutRef<"a">) => (
  <a className={actionClass(variant, className)} {...rest}>
    {children}
  </a>
);

/* -------------------------------------------------------------------------
 * Surfaces
 * ---------------------------------------------------------------------- */

export const SectionIntro = ({
  title,
  children,
  aside,
  className,
}: {
  readonly title: ReactNode;
  readonly children?: ReactNode;
  /** A small muted line under the paragraph — a link, a count, a caveat. */
  readonly aside?: ReactNode;
  readonly className?: string;
}) => (
  <div className={cn("flex flex-col items-center gap-5 text-center", className)}>
    <h2 className="type-display-lg max-w-[36ch] text-balance text-foreground">{title}</h2>
    {children ? <p className="type-lead max-w-[56ch] text-pretty text-muted">{children}</p> : null}
    {aside ? <div className="text-[0.8125rem] text-ink-subtle">{aside}</div> : null}
  </div>
);
