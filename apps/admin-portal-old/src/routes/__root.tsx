import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRoute } from "@tanstack/react-router";

import "@/styles.css";
import { Toast } from "@namera-ai/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Operator reads share a global hourly budget on the server, so refetching
      // on every window focus would spend it for no new information.
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 15_000,
    },
  },
});

export const Route = createRootRoute({ component: RootComponent });

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="bg-background text-foreground font-inter min-h-screen">
        <Outlet />
        <Toast.Provider placement="bottom end" maxVisibleToasts={3} />
      </div>
    </QueryClientProvider>
  );
}
