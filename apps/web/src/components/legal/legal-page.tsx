import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import type { TOCItemType } from "fumadocs-core/toc";

import { Container } from "#/components/marketing/primitives";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";

const legalLinks = [
  { to: "/terms", label: "Terms of Service" },
  { to: "/privacy-policy", label: "Privacy Policy" },
] as const;

export const LegalPage = ({
  title,
  description,
  toc,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly toc: readonly TOCItemType[];
  readonly children: ReactNode;
}) => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main id="main" className="pt-14">
      <Container className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <header className="border-b-1 border-border pb-10 md:pb-12">
            <nav aria-label="Legal documents" className="mb-10 flex flex-wrap gap-x-6 gap-y-3">
              {legalLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="tap-target inline-flex items-center rounded-sm py-2 text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                  activeProps={{
                    className: "text-foreground underline underline-offset-8",
                    "aria-current": "page",
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <h1 className="type-display-lg text-foreground">{title}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-muted">{description}</p>
            <p className="mt-6 text-sm text-ink-subtle">
              Effective <time dateTime="2026-10-05">October 5, 2026</time>
            </p>
          </header>
          <div className="mt-10 grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-20">
            <aside className="lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
              <nav aria-label="On this page">
                <h2 className="mb-4 text-sm font-medium text-foreground">On this page</h2>
                <ol className="space-y-1">
                  {toc
                    .filter((entry) => entry.depth === 2)
                    .map((entry) => (
                      <li key={entry.url}>
                        <a
                          href={entry.url}
                          className="tap-target inline-flex rounded-sm py-1.5 text-sm leading-6 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
                        >
                          {entry.title}
                        </a>
                      </li>
                    ))}
                </ol>
              </nav>
            </aside>
            <article
              aria-label={title}
              className="min-w-0 max-w-[46rem] break-words lg:col-start-1 lg:row-start-1"
            >
              {children}
            </article>
          </div>
        </div>
      </Container>
    </main>
    <SiteFooter />
  </div>
);
