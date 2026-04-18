import { useState } from "react";

import { Link } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@namera-ai/ui/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@namera-ai/ui/components/ui/sheet";
import { NameraIcon } from "@namera-ai/ui/icons";

const productItems = [
  {
    description: "Manage smart wallets, session keys through a unified layer",
    title: "Platform",
    url: "/docs",
  },
  {
    description:
      "Integrate programmable wallets into your app or agent workflows",
    title: "SDKs",
    url: "/docs/sdk",
  },
  {
    description: "Operate wallets through CLI or MCP with full control",
    title: "CLI",
    url: "/docs/cli",
  },
];

const resourcesItems = [
  {
    description: "Build agent wallets using Namera",
    title: "Developers",
    url: "/docs/sdk",
  },
  {
    description: "Integrate Namera into your apps",
    title: "Docs",
    url: "/docs",
  },
  {
    description: "Learn more about Namera and its use cases",
    title: "Blog",
    url: "/blog",
  },
  {
    description: "All updates to Namera",
    title: "Changelog",
    url: "/changelog",
  },
];

const HamburgerIcon = ({ open }: { open: boolean }) => (
  <svg
    aria-hidden={true}
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    {open ? (
      <>
        <line x1="18" x2="6" y1="6" y2="18" />
        <line x1="6" x2="18" y1="6" y2="18" />
      </>
    ) : (
      <>
        <line x1="4" x2="20" y1="7" y2="7" />
        <line x1="4" x2="20" y1="12" y2="12" />
        <line x1="4" x2="20" y1="17" y2="17" />
      </>
    )}
  </svg>
);

const MobileMenu = () => {
  const [open, setOpen] = useState(false);

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetTrigger
        aria-label="Open menu"
        className="sm:hidden inline-flex items-center justify-center size-9 rounded-md border border-white/10 bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        <HamburgerIcon open={open} />
      </SheetTrigger>
      <SheetContent
        className="w-full sm:max-w-sm bg-[#0b0c0d] border-l border-white/10 p-0"
        side="right"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-white/10">
          <SheetTitle className="flex items-center gap-2 text-left">
            <NameraIcon className="fill-white size-5" />
            <span className="text-lg font-semibold tracking-tight">Namera</span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-8 px-6 py-6 overflow-y-auto">
          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/40">
              Product
            </div>
            <div className="flex flex-col gap-1">
              {productItems.map((item) => (
                <Link
                  className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.04]"
                  key={item.title}
                  onClick={() => setOpen(false)}
                  to={item.url}
                >
                  <span className="font-medium text-white">{item.title}</span>
                  <span className="text-xs text-white/50 leading-snug">
                    {item.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-white/40">
              Resources
            </div>
            <div className="flex flex-col gap-1">
              {resourcesItems.map((item) => (
                <Link
                  className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-white/[0.04]"
                  key={item.title}
                  onClick={() => setOpen(false)}
                  to={item.url}
                >
                  <span className="font-medium text-white">{item.title}</span>
                  <span className="text-xs text-white/50 leading-snug">
                    {item.description}
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-white/10">
            <Link
              className="rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:text-white hover:bg-white/[0.04] transition-colors"
              onClick={() => setOpen(false)}
              to="/docs/$"
            >
              Docs
            </Link>
            <Link
              className="mt-2 inline-flex items-center justify-center rounded-lg bg-white px-3 py-2.5 text-sm font-medium text-black hover:bg-white/90 transition-colors"
              onClick={() => setOpen(false)}
              to="/docs/$"
            >
              Get Started
            </Link>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export const Menu = () => {
  return (
    <>
      <NavigationMenu className="hidden sm:flex">
        <NavigationMenuList>
          <NavigationMenuItem className="hidden sm:flex">
            <NavigationMenuTrigger className="font-medium">
              Product
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="w-lg bg-muted rounded-md border grid grid-cols-2 gap-2 p-2 divide-x divide-accent">
                {productItems.map((item) => {
                  return (
                    <Link key={item.title} to={item.url}>
                      <li className="flex flex-col gap-1 text-xs hover:bg-accent transition p-3 rounded-lg">
                        <div className="text-muted-foreground font-medium">
                          {item.title}
                        </div>
                        <div>{item.description}</div>
                      </li>
                    </Link>
                  );
                })}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem className="hidden sm:flex">
            <NavigationMenuTrigger className="font-medium">
              Resources
            </NavigationMenuTrigger>
            <NavigationMenuContent>
              <ul className="w-lg bg-muted rounded-md border grid grid-cols-2 gap-2 p-2 divide-x divide-accent">
                {resourcesItems.map((item) => {
                  return (
                    <Link key={item.title} to={item.url}>
                      <li className="flex flex-col gap-1 text-xs hover:bg-accent transition p-3 rounded-lg">
                        <div className="text-muted-foreground font-medium">
                          {item.title}
                        </div>
                        <div>{item.description}</div>
                      </li>
                    </Link>
                  );
                })}
              </ul>
            </NavigationMenuContent>
          </NavigationMenuItem>
          <NavigationMenuItem className="hidden sm:flex">
            <NavigationMenuLink
              className={navigationMenuTriggerStyle({
                className: "font-medium",
              })}
              render={<Link to="/blog" />}
            >
              Blog
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem className="hidden sm:flex">
            <NavigationMenuLink
              className={navigationMenuTriggerStyle({
                className: "font-medium",
              })}
              render={<Link to="/changelog" />}
            >
              Changelog
            </NavigationMenuLink>
          </NavigationMenuItem>
          <div className="h-5 border-r hidden sm:block" />
          <NavigationMenuItem>
            <NavigationMenuLink
              className={navigationMenuTriggerStyle({
                className: "font-medium",
              })}
              render={<Link to="/docs/$" />}
            >
              Docs
            </NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuItem
            render={
              <Button
                className="bg-accent-foreground text-accent font-medium hover:bg-accent-foreground/80!"
                render={<Link to="/docs/$" />}
              />
            }
          >
            Get Started
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      {/* Mobile hamburger drawer */}
      <MobileMenu />
    </>
  );
};
