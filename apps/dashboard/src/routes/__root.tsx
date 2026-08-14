import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import "@/styles.css";
import { Toast } from "@namera-ai/ui";
import { WagmiProvider } from "wagmi";

import { wagmiConfig } from "@/lib/wagmi";
import type { RouterContext } from "@/router-context";

const queryClient = new QueryClient();

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div className="bg-[#010102] text-foreground min-h-screen font-inter">
          <Outlet />
          <Toast.Provider placement="bottom end" maxVisibleToasts={3} />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
