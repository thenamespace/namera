import { NameraIcon } from "@namera-ai/ui/icons";
import { cn } from "@namera-ai/ui/lib/utils";

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
    <div className="flex flex-col gap-4">
      <footer className="w-full">
        <div className="max-w-7xl mx-auto border-t border-b w-full flex flex-col md:flex-row items-start justify-between p-10 md:gap-4 gap-12">
          <div className="flex flex-col gap-6 order-2 md:order-1 mx-auto md:mx-0">
            <div className="flex flex-row items-center gap-2 justify-center md:justify-start">
              <NameraIcon className="size-5 fill-white" />
              <div className="text-xl text-white font-medium">Namera</div>
            </div>
            <p className="text-muted-foreground text-xs max-w-xs text-center md:text-left">
              Secure, programmable smart accounts for autonomous agents.
            </p>
          </div>
          <div className="grid sm:grid-cols-3 md:gap-4 grid-cols-2 mx-auto gap-8 order-1 md:order-2 md:mx-0">
            {navigationGroups.map((group) => {
              return (
                <div
                  className="flex flex-col gap-2 w-full place-items-start"
                  key={group.title}
                >
                  <div className="text-sm text-foreground pb-3">
                    {group.title}
                  </div>
                  {group.links.map((link) => {
                    const isExternal = link.external;

                    return (
                      <a
                        className="text-muted-foreground hover:text-foreground text-sm transition-all"
                        href={link.href}
                        key={link.title}
                        rel="noopener noreferrer"
                        target={isExternal ? "_blank" : "_self"}
                      >
                        {link.title}
                      </a>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </footer>
      <div
        className={cn(
          "max-w-7xl justify-center md:justify-end flex mx-auto w-full text-xs text-muted-foreground",
          showDesign
            ? "pb-[10dvh] sm:pb-[15dvh] md:pb-[20dvh] px-4 lg:pb-[25dvh]"
            : "pb-4",
        )}
      >
        © 2026 Namespace Inc. All rights reserved.
      </div>
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
