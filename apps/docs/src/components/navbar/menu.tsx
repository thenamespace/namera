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

export const Menu = () => {
  return (
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem className="hidden sm:flex">
          <NavigationMenuTrigger>Product</NavigationMenuTrigger>
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
          <NavigationMenuTrigger>Resources</NavigationMenuTrigger>
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
            className={navigationMenuTriggerStyle()}
            render={<Link to="/blog" />}
          >
            Blog
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem className="hidden sm:flex">
          <NavigationMenuLink
            className={navigationMenuTriggerStyle()}
            render={<Link to="/changelog" />}
          >
            Changelog
          </NavigationMenuLink>
        </NavigationMenuItem>
        <div className="h-5 border-r hidden sm:block" />
        <NavigationMenuItem>
          <NavigationMenuLink
            className={navigationMenuTriggerStyle()}
            render={<Link to="/docs/$" />}
          >
            Docs
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem render={<Button render={<Link to="/docs/$" />} />}>
          Get Started
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
};
