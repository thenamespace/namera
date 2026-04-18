import { Link } from "@tanstack/react-router";

import { NameraIcon } from "@namera-ai/ui/icons";

const navigationGroups = [
  {
    links: [
      {
        external: false,
        href: "/docs",
        title: "Platform",
      },
      {
        external: false,
        href: "/docs/sdk",
        title: "SDKs",
      },
      {
        external: false,
        href: "/docs/cli",
        title: "CLI",
      },
    ],
    title: "Product",
  },
  {
    links: [
      {
        external: false,
        href: "/blog",
        title: "Blog",
      },
      {
        external: false,
        href: "/changelog",
        title: "Changelog",
      },
      {
        external: true,
        href: "https://github.com/thenamespace/namera",
        title: "GitHub",
      },
      {
        external: true,
        href: "https://x.com/namera_ai",
        title: "X/Twitter",
      },
      {
        external: true,
        href: "https://linkedin.com/company/namera-ai",
        title: "LinkedIn",
      },
    ],
    title: "Company",
  },
  {
    links: [
      {
        external: false,
        href: "/docs",
        title: "Documentation",
      },
      {
        external: false,
        href: "/terms",
        title: "Terms of Service",
      },
      {
        external: false,
        href: "/privacy-policy",
        title: "Privacy Policy",
      },
    ],
    title: "Resources",
  },
];

export const Footer = ({ showDesign = true }: { showDesign?: boolean }) => {
  return (
    <div className="relative flex flex-col gap-4 mt-16">
      {/* Gradient divider above footer */}
      <div
        aria-hidden={true}
        className="pointer-events-none max-w-7xl mx-auto w-full h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
        }}
      />
      <footer className="w-full">
        <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row items-start justify-between p-10 md:gap-4 gap-12 border-b border-white/10">
          <div className="flex flex-col gap-6 order-2 md:order-1 mx-auto md:mx-0">
            <div className="flex flex-row items-center gap-2 justify-center md:justify-start">
              <NameraIcon className="size-5 fill-white" />
              <div className="text-xl text-white font-semibold tracking-tight">
                Namera
              </div>
            </div>
            <p className="max-w-sm text-center text-sm leading-relaxed text-muted-foreground md:text-left md:text-base">
              Secure, programmable smart accounts for autonomous agents.
            </p>
            <p className="text-center text-[11px] text-muted-foreground/80 md:text-left">
              © 2026 Namespace Inc. All rights reserved.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 md:gap-4 grid-cols-2 mx-auto gap-8 order-1 md:order-2 md:mx-0">
            {navigationGroups.map((group) => {
              return (
                <div
                  className="flex flex-col gap-2 w-full place-items-start"
                  key={group.title}
                >
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 pb-3">
                    {group.title}
                  </div>
                  {group.links.map((link) => {
                    const isExternal = link.external;

                    if (isExternal) {
                      return (
                        <a
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                          href={link.href}
                          key={link.title}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {link.title}
                        </a>
                      );
                    }

                    return (
                      <Link
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                        key={link.title}
                        to={link.href}
                      >
                        {link.title}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </footer>
      <div
        className={
          showDesign
            ? "pb-[10dvh] sm:pb-[15dvh] md:pb-[20dvh] lg:pb-[25dvh]"
            : "pb-4"
        }
      />
      {showDesign && (
        <div className="absolute bottom-0 left-1/2 overflow-hidden -translate-x-1/2 pointer-events-none w-full flex justify-center">
          {/* Ambient glow behind giant text */}
          <div
            aria-hidden={true}
            className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-64 w-[90%] blur-3xl opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 60% 80% at 50% 100%, rgba(214,254,81,0.08), transparent 70%)",
            }}
          />
          <div className="text-[30dvw] sm:text-[30dvw] leading-none select-none text-transparent bg-clip-text translate-y-1/4 font-semibold tracking-tight [-webkit-text-stroke:1px_var(--color-neutral-800)]">
            namera
          </div>
        </div>
      )}
    </div>
  );
};
