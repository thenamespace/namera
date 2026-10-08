import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui";

import { clearToken, readToken } from "@/lib/session";

export const Route = createFileRoute("/_authed")({
  beforeLoad: () => {
    // No return-to parameter: the token is gone, so every screen behind this
    // layout is unreachable anyway, and sign-in always lands on invites.
    if (!readToken()) throw redirect({ to: "/login" });
  },
  component: AuthedLayout,
});

const destinations = [
  { to: "/invites", label: "Invites" },
  { to: "/users", label: "Users" },
  { to: "/waitlist", label: "Waitlist" },
] as const;

function AuthedLayout() {
  const navigate = useNavigate();

  const signOut = async () => {
    clearToken();
    await navigate({ to: "/login" });
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* The nav wraps rather than collapsing behind a menu: three destinations
          fit on a phone, and a hidden menu would cost a tap on every screen. */}
      <header className="border-border sticky top-0 z-10 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-sm font-medium">Namera Operations</span>
          <nav aria-label="Sections" className="flex flex-wrap items-center gap-x-1 gap-y-1">
            {destinations.map((destination) => (
              <Link
                key={destination.to}
                to={destination.to}
                className="text-muted hover:text-foreground focus-visible:outline-focus data-[status=active]:text-foreground flex min-h-11 items-center rounded-md px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                activeProps={{ "data-status": "active" }}
              >
                {destination.label}
              </Link>
            ))}
          </nav>
          <Button className="ms-auto" variant="tertiary" onPress={signOut}>
            Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
