import type { ReactNode } from "react";

import { Container } from "#/components/marketing/primitives";
import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";

export const LegalPage = ({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) => (
  <div className="min-h-screen bg-background">
    <SiteHeader />
    <main id="main" className="pt-14">
      <Container className="py-20 md:pt-40 md:pb-28">
        <div className="mx-auto max-w-[44rem]">
          <header className="mb-10 md:mb-12">
            <h1 className="type-display-xl text-foreground">{title}</h1>
            <p className="mt-8 text-sm text-ink-subtle md:mt-10">
              Effective date: <time dateTime="2026-10-05">October 5, 2026</time>
            </p>
          </header>
          <article aria-label={title} className="min-w-0 break-words">
            {children}
          </article>
        </div>
      </Container>
    </main>
    <SiteFooter />
  </div>
);
