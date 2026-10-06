import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { GithubIcon, Icon, LinkedinIcon, NameraIcon, NewTwitterIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";

import { Container } from "#/components/marketing/primitives";
import { linked, SITE_LINKS } from "#/lib/site-links";

/*
 * Columns of links, in the shape the reference set uses, with one rule of our
 * own: a link renders only when it has somewhere real to go. Internal routes
 * are `Link`s, everything else comes from `site-links.ts` and is dropped when
 * its value is null. A column with nothing left in it does not render.
 */

type FooterLink = {
  readonly label: string;
  readonly href: string | null;
  /** Routes inside this app, which render as a router Link. */
  readonly internal?: boolean;
};

const COLUMNS: readonly { readonly title: string; readonly links: readonly FooterLink[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Playground", href: "/#playground" },
      { label: "Limits", href: "/#limits" },
      { label: "Clients", href: "/#clients" },
      { label: "Pricing", href: "/pricing", internal: true },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Blog", href: "/blog", internal: true },
      { label: "Changelog", href: SITE_LINKS.changelog },
      { label: "API reference", href: SITE_LINKS.apiReference },
      { label: "Status", href: SITE_LINKS.status },
      { label: "Contact", href: SITE_LINKS.contact },
    ],
  },
];

const SOCIALS = [
  { icon: GithubIcon, label: "GitHub", href: SITE_LINKS.github },
  { icon: NewTwitterIcon, label: "X", href: SITE_LINKS.x },
  { icon: LinkedinIcon, label: "LinkedIn", href: SITE_LINKS.linkedin },
];

const linkClass = cn(
  "inline-flex h-8 items-center rounded-sm text-[0.8125rem] text-ink-subtle",
  "transition-colors duration-150 ease-out-quad hover:text-foreground",
  "focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-focus/60",
);

export const SiteFooter = () => {
  const [year] = useState(() => new Date().getFullYear());
  const columns = COLUMNS.map((column) => ({
    title: column.title,
    links: column.links.filter((link): link is FooterLink & { href: string } => link.href !== null),
  })).filter((column) => column.links.length > 0);

  const socials = linked(SOCIALS);

  return (
    <footer className="relative overflow-hidden border-t-1 border-border">
      <Container className="pt-16 pb-3 md:pt-20 md:pb-4">
        <div className="flex flex-col gap-12 lg:flex-row lg:justify-between lg:gap-24">
          <div className="flex flex-col gap-4">
            <span className="inline-flex items-center gap-2.5 text-foreground">
              <NameraIcon aria-hidden fill="currentColor" className="h-3.5 w-auto" />
              <span className="text-[0.9375rem] leading-none font-semibold tracking-[-0.02em]">
                Namera
              </span>
            </span>
            <p className="max-w-[26ch] text-[0.8125rem] text-pretty text-ink-subtle">
              The permission layer for agent wallets.
            </p>

            {socials.length > 0 ? (
              <ul className="-ml-2.5 mt-1 flex items-center gap-1">
                {socials.map((social) => (
                  <li key={social.label}>
                    <a
                      href={social.href}
                      aria-label={social.label}
                      className={cn(
                        "grid size-10 place-items-center rounded-lg text-ink-subtle",
                        "transition-colors duration-150 ease-out-quad hover:bg-default/60 hover:text-foreground",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
                      )}
                    >
                      <Icon icon={social.icon} aria-hidden strokeWidth={1.6} className="size-4" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-x-10 gap-y-10 lg:gap-x-20">
            {columns.map((column) => (
              <nav key={column.title} aria-label={column.title}>
                <h2 className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-ink-subtle">
                  {column.title}
                </h2>
                <ul className="mt-4 flex flex-col">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {link.internal === true ? (
                        <Link to={link.href} className={linkClass}>
                          {link.label}
                        </Link>
                      ) : (
                        <a href={link.href} className={linkClass}>
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-3 border-t-1 border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.75rem] text-ink-subtle">
            © {year} Namespace Inc. All rights reserved.
          </p>
          <nav aria-label="Legal" className="flex items-center gap-5">
            {SITE_LINKS.privacy ? (
              <Link to={SITE_LINKS.privacy} className={cn(linkClass, "tap-target text-xs")}>
                Privacy Policy
              </Link>
            ) : null}
            {SITE_LINKS.terms ? (
              <Link to={SITE_LINKS.terms} className={cn(linkClass, "tap-target text-xs")}>
                Terms
              </Link>
            ) : null}
          </nav>
        </div>
      </Container>

      {/* Oversized wordmark sitting below the copy, bleeding off the bottom edge
          so it reads as texture. Kept clear of the text above it — nothing
          overlaps. */}
      <p
        aria-hidden
        className="pointer-events-none -mb-[0.3em] select-none text-center font-semibold leading-none tracking-[-0.05em] text-transparent [-webkit-text-stroke:1.5px_rgb(247_248_248/0.1)] text-[clamp(3.5rem,25vw,18rem)]"
      >
        namera
      </p>
    </footer>
  );
};
