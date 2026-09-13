import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";

import { RootProvider } from "fumadocs-ui/provider/tanstack";

import styles from "#/styles.css?url";

const theme = { enabled: false };

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Namera" },
    ],
    links: [{ rel: "stylesheet", href: styles }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background font-sans text-foreground">
        <RootProvider theme={theme}>
          <Outlet />
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
