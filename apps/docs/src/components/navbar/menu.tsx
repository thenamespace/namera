import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@namera-ai/ui/components/ui/navigation-menu";
import { McpIcon } from "@namera-ai/ui/icons";
import {
  BuildingIcon,
  CurrencyEthIcon,
  LegoIcon,
  NewspaperIcon,
  PenNibIcon,
  ScrollIcon,
  TerminalIcon,
} from "@phosphor-icons/react";

const platformContents = [
  {
    icon: BuildingIcon,
    path: "",
    tagline: "Agent-native wallet layer",
    title: "Protocol",
  },
  {
    icon: LegoIcon,
    path: "sdk",
    tagline: "Build agent wallets",
    title: "SDK",
  },
  {
    icon: TerminalIcon,
    path: "cli",
    tagline: "Manage keys locally",
    title: "CLI",
  },
  {
    comingSoon: true,
    icon: McpIcon,
    path: "mcp",
    tagline: "Secure agent execution",
    title: "MCP",
  },
  {
    comingSoon: true,
    icon: CurrencyEthIcon,
    path: "x402",
    tagline: "Native onchain payments",
    title: "x402 Payments",
  },
];

const companyItems = [
  {
    icon: ScrollIcon,
    path: "",
    title: "Guides",
  },
  {
    icon: PenNibIcon,
    path: "/blog",
    title: "Blog",
  },
  {
    icon: NewspaperIcon,
    path: "",
    title: "Changelog",
  },
];

const components: { title: string; href: string; description: string }[] = [
  {
    description:
      "A modal dialog that interrupts the user with important content and expects a response.",
    href: "/docs/primitives/alert-dialog",
    title: "Alert Dialog",
  },
  {
    description:
      "For sighted users to preview content available behind a link.",
    href: "/docs/primitives/hover-card",
    title: "Hover Card",
  },
  {
    description:
      "Displays an indicator showing the completion progress of a task, typically displayed as a progress bar.",
    href: "/docs/primitives/progress",
    title: "Progress",
  },
  {
    description: "Visually or semantically separates content.",
    href: "/docs/primitives/scroll-area",
    title: "Scroll-area",
  },
  {
    description:
      "A set of layered sections of content—known as tab panels—that are displayed one at a time.",
    href: "/docs/primitives/tabs",
    title: "Tabs",
  },
  {
    description:
      "A popup that displays information related to an element when the element receives keyboard focus or the mouse hovers over it.",
    href: "/docs/primitives/tooltip",
    title: "Tooltip",
  },
];
export const Menu = () => {
  return (
    <NavigationMenu>
      <NavigationMenuList className="hidden sm:flex">
        <NavigationMenuItem>
          <NavigationMenuTrigger>Platform</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="w-54">
              {platformContents.map((content) => (
                <li key={content.title}>
                  <NavigationMenuLink
                    className="hover:bg-[#727DA1]/15 text-neutral-200"
                    render={
                      <Link
                        disabled={content.comingSoon}
                        // biome-ignore lint/style/useNamingConvention: safe
                        params={{ _splat: content.path }}
                        to="/docs/$"
                      />
                    }
                  >
                    <div className="flex flex-row gap-2 items-start">
                      <content.icon
                        className="size-6 fill-[url(#gradient-primary)] mt-1"
                        weight="fill"
                      />
                      <div className="flex flex-col">
                        <div className="text-sm">{content.title}</div>
                        <div className="text-muted-foreground">
                          {content.tagline}
                        </div>
                      </div>
                    </div>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem className="hidden md:flex">
          <NavigationMenuTrigger>Getting Started</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-100 gap-2 md:w-125 md:grid-cols-2 lg:w-150">
              {components.map((component) => (
                <ListItem
                  href={component.href}
                  key={component.title}
                  title={component.title}
                >
                  {component.description}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem className="hidden sm:flex">
          <NavigationMenuLink
            className={navigationMenuTriggerStyle()}
            render={<Link to="/docs/$" />}
          >
            Documentation
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Company</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="w-54">
              {companyItems.map((item) => (
                <li key={item.title}>
                  <NavigationMenuLink
                    className="hover:bg-[#727DA1]/15 text-neutral-200"
                    render={
                      // biome-ignore lint/style/useNamingConvention: safe
                      <Link params={{ _splat: item.path }} to={item.path} />
                    }
                  >
                    <div className="flex flex-row gap-2 items-center">
                      <item.icon
                        className="size-5 fill-accent-foreground"
                        weight="fill"
                      />
                      <div className="text-sm">{item.title}</div>
                    </div>
                  </NavigationMenuLink>
                </li>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};

function ListItem({
  title,
  children,
  href,
  icon,
  ...props
}: React.ComponentPropsWithoutRef<"li"> & { href: string; icon?: ReactNode }) {
  return (
    <li {...props}>
      <NavigationMenuLink
        className="hover:bg-[#727DA1]/15"
        render={<Link to={href} />}
      >
        <div className="flex flex-col gap-1 text-sm">
          <div className="flex flex-row gap-2">
            {icon}
            <div className="leading-none font-medium">{title}</div>
          </div>
          <div className="line-clamp-2 text-muted-foreground">{children}</div>
        </div>
      </NavigationMenuLink>
    </li>
  );
}
