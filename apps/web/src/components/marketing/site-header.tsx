import { useEffect, useState } from "react";

import { Cancel01Icon, Icon, Menu02Icon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/utils";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ActionAnchor } from "#/components/marketing/primitives";
import { Wordmark } from "#/components/marketing/wordmark";
import { SITE_LINKS } from "#/lib/site-links";

// Every item resolves to a section that exists on this page (R-24).
const NAV_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
] as const;

/**
 * Sticky bar. Transparent over the hero, then a blurred canvas wash and a
 * hairline once the page has moved. The border is what separates it from the
 * content, not a shadow.
 */
export const SiteHeader = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  // The open sheet locks the page behind it, which makes it modal enough that
  // Escape has to close it (R-26). Both behaviours belong to the same state.
  useEffect(() => {
    if (!menuOpen) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b-1 transition-colors duration-200 ease-out-quad",
        scrolled || menuOpen
          ? "border-border/60 bg-background/72 backdrop-blur-xl backdrop-saturate-150"
          : "border-border/60 bg-transparent",
      )}
    >
      <div className="marketing-container mx-auto flex h-14 w-full max-w-[1440px] items-center gap-6 px-6 md:px-10 lg:px-14">
        <Wordmark />

        <nav aria-label="Main" className="ml-auto hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={cn(
                "tap-target inline-flex h-8 items-center rounded-md px-2 text-[0.8125rem] text-muted",
                "transition-colors duration-150 ease-out-quad hover:text-foreground",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
              )}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <span aria-hidden="true" className="mr-2 hidden h-4 w-px bg-border md:block" />
          <a
            href={SITE_LINKS.docs}
            className="tap-target mr-2 hidden h-8 items-center rounded-md px-2 text-[0.8125rem] text-muted transition-colors duration-150 ease-out-quad hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60 md:inline-flex"
          >
            Docs
          </a>
          {/* Renders only when site-links.ts has a confirmed destination. */}
          {SITE_LINKS.app === null ? null : (
            <ActionAnchor
              href={SITE_LINKS.app}
              variant="light"
              className="h-8 rounded-md px-3 text-[0.8125rem]"
            >
              Get started
            </ActionAnchor>
          )}

          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => {
              setMenuOpen((open) => !open);
            }}
            className={cn(
              "tap-target -mr-1.5 inline-flex size-10 items-center justify-center rounded-lg text-muted md:hidden",
              "transition-colors duration-150 ease-out-quad hover:bg-default/60 hover:text-foreground",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus/60",
            )}
          >
            <Icon
              icon={menuOpen ? Cancel01Icon : Menu02Icon}
              aria-hidden
              strokeWidth={1.8}
              className="size-4.5"
            />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {menuOpen ? (
          <motion.div
            key="mobile-nav"
            className="overflow-hidden border-t-1 border-border md:hidden"
            initial={{ height: reduced ? "auto" : 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: reduced ? "auto" : 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <nav aria-label="Mobile" className="flex flex-col gap-0.5 px-4 py-3">
              {[...NAV_LINKS, { label: "Docs", href: SITE_LINKS.docs }].map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    setMenuOpen(false);
                  }}
                  className="tap-target flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] text-muted hover:bg-default/60 hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              {/* Get started stays in the bar at every width, so repeating it
                  inside the sheet would be the same control twice. */}
            </nav>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
};
