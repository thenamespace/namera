import { Link } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import { NameraIcon } from "@namera-ai/ui/icons";
import {
  GithubLogoIcon,
  LinkedinLogoIcon,
  XLogoIcon,
} from "@phosphor-icons/react";

const navigationGroups = [
  {
    links: [
      { external: false, href: "/docs", title: "Platform" },
      { external: false, href: "/docs/sdk", title: "SDKs" },
      { external: false, href: "/docs/cli", title: "CLI" },
    ],
    title: "Product",
  },
  {
    links: [
      { external: false, href: "/blog", title: "Blog" },
      { external: false, href: "/docs", title: "Dev Docs" },
      { external: false, href: "/changelog", title: "Changelog" },
    ],
    title: "Company",
  },
  {
    links: [
      { external: false, href: "/terms", title: "Terms of Service" },
      { external: false, href: "/privacy-policy", title: "Privacy Policy" },
    ],
    title: "Legal",
  },
];

const socials = [
  {
    href: "https://github.com/thenamespace/namera",
    icon: GithubLogoIcon,
    label: "GitHub",
  },
  {
    href: "https://x.com/namera_ai",
    icon: XLogoIcon,
    label: "X / Twitter",
  },
  {
    href: "https://linkedin.com/company/namera-ai",
    icon: LinkedinLogoIcon,
    label: "LinkedIn",
  },
];

export const Footer = ({ showDesign = true }: { showDesign?: boolean }) => {
  return (
    <div className="relative flex flex-col gap-4 mt-16">
      <div
        aria-hidden={true}
        className="pointer-events-none max-w-7xl mx-auto w-full h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)",
        }}
      />
      <footer className="w-full">
        <div className="max-w-7xl flex flex-col w-full mx-auto">
          <div className="w-full flex flex-col md:flex-row items-start justify-between p-10 md:gap-4 gap-12 border-b border-white/10">
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
              {/* Social icons */}
              <div className="flex items-center justify-center gap-3 md:justify-start">
                {socials.map(({ href, icon: Icon, label }) => (
                  <Button
                    key={label}
                    render={
                      // biome-ignore lint/a11y/useAnchorContent: safe as we pass it in button
                      <a
                        href={href}
                        rel="noopener noreferrer"
                        target="_blank"
                      />
                    }
                    size="icon"
                    variant="outline"
                  >
                    <Icon className="size-4" />
                    <span className="sr-only">{label}</span>
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex flex-col items-end justify-between gap-8 order-1 md:order-2 md:mx-0">
              <div className="grid sm:grid-cols-3 md:gap-4 grid-cols-2 mx-auto gap-8 md:mx-0">
                {navigationGroups.map((group) => (
                  <div
                    className="flex flex-col gap-2 w-full place-items-start"
                    key={group.title}
                  >
                    <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40 pb-3">
                      {group.title}
                    </div>
                    {group.links.map((link) =>
                      link.external ? (
                        <a
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                          href={link.href}
                          key={link.title}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {link.title}
                        </a>
                      ) : (
                        <Link
                          className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                          key={link.title}
                          to={link.href}
                        >
                          {link.title}
                        </Link>
                      ),
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="p-4 flex justify-center md:justify-end text-[11px] text-muted-foreground/80">
            © 2026 Namespace Inc. All rights reserved.
          </p>
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
        <div className="absolute bottom-0 left-1/2 overflow-hidden -translate-x-1/2 pointer-events-none">
          <div className="text-[30dvw] sm:text-[30dvw] leading-none select-none text-muted [textStroke:1px_var(--color-neutral-700)] translate-y-1/4 [-webkit-text-stroke:1px_var(--color-neutral-700)]">
            namera
          </div>
        </div>
      )}
    </div>
  );
};
