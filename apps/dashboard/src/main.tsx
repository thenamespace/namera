import ReactDOM from "react-dom/client";

import { RouterProvider, createRouter } from "@tanstack/react-router";

import { atomRegistry } from "./lib/atom";
import { AtomProvider } from "./providers/atom";
import { routeTree } from "./route-tree.gen";

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  scrollRestoration: true,
  context: {
    atomRegistry,
  },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("app")!;

if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <AtomProvider registry={atomRegistry}>
      <RouterProvider router={router} />
    </AtomProvider>,
  );
}
