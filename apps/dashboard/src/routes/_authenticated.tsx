import { useCallback } from "react";

import { Link, Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/react-router";

import { Avatar, Button, Chip, Separator, Typography } from "@namera-ai/ui";
import { Home01Icon, HugeiconsIcon, Logout03Icon } from "@namera-ai/ui/icons";

import { currentUserAtom, prefetchQuery } from "@/atoms";
import { Brand } from "@/components/brand";
import { useLogout } from "@/hooks";

export const Route = createFileRoute("/_authenticated")({
  loader: async ({ abortController, context }) => {
    try {
      return await prefetchQuery(context.atomRegistry, currentUserAtom, abortController.signal);
    } catch {
      throw redirect({ to: "/auth" });
    }
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const actor = Route.useLoaderData();
  const navigate = useNavigate();
  const logout = useLogout();
  const logoutAsync = logout.mutateAsync;
  const displayName = actor.user.metadata.name ?? actor.user.email;
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleLogout = useCallback(async () => {
    try {
      await logoutAsync();
      await navigate({ to: "/auth" });
    } catch {
      // The mutation exposes the failure state to the rendered button area.
    }
  }, [logoutAsync, navigate]);

  return (
    <div className="bg-background min-h-screen">
      <a
        className="bg-foreground text-background focus-visible:ring-accent fixed top-3 left-3 z-50 -translate-y-20 rounded-md px-3 py-2 text-sm focus-visible:translate-y-0 focus-visible:ring-2"
        href="#main-content"
      >
        Skip to content
      </a>

      <header className="bg-surface/95 sticky top-0 z-40 border-b border-separator backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
          <Link className="shrink-0" to="/dashboard" aria-label="Namera dashboard">
            <Brand />
          </Link>
          <Separator className="hidden h-6 sm:block" orientation="vertical" />
          <nav className="hidden items-center sm:flex" aria-label="Primary navigation">
            <Link
              aria-current="page"
              className="bg-default hover:bg-default-hover focus-visible:ring-accent flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-offset-2"
              to="/dashboard"
            >
              <HugeiconsIcon aria-hidden="true" icon={Home01Icon} size={17} />
              Overview
            </Link>
          </nav>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <Chip className="hidden max-w-56 sm:inline-flex" variant="soft">
              <Chip.Label className="truncate">{actor.organization.metadata.name}</Chip.Label>
            </Chip>
            <Avatar size="sm">
              <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
            <div className="hidden min-w-0 md:block">
              <Typography.Paragraph className="max-w-48 truncate" size="sm" weight="medium">
                {displayName}
              </Typography.Paragraph>
              <Typography.Paragraph className="max-w-48 truncate" color="muted" size="xs">
                {actor.user.email}
              </Typography.Paragraph>
            </div>
            <Button
              aria-label="Sign out"
              isDisabled={logout.isPending}
              isIconOnly
              onPress={handleLogout}
              variant="ghost"
            >
              <HugeiconsIcon aria-hidden="true" icon={Logout03Icon} size={18} />
            </Button>
          </div>
        </div>
        {logout.isError ? (
          <p className="sr-only" role="alert">
            Sign out failed. Please try again.
          </p>
        ) : null}
      </header>

      <main id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
