import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { Button } from "@namera-ai/ui";

import { SiteFooter } from "#/components/marketing/site-footer";
import { SiteHeader } from "#/components/marketing/site-header";

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
  pendingComponent: () => (
    <output className="mx-auto px-6 py-32 text-muted">Loading article…</output>
  ),
  errorComponent: ({ reset }) => (
    <div className="px-6 py-32 text-center">
      <h1 className="mb-6 text-2xl">Couldn't load the blog</h1>
      <Button onPress={reset}>Try again</Button>
    </div>
  ),
  notFoundComponent: () => (
    <div className="px-6 py-32 text-center">
      <h1 className="mb-6 text-2xl">Article not found</h1>
      <Link to="/blog" className="underline">
        Back to the blog
      </Link>
    </div>
  ),
});
function BlogLayout() {
  return (
    <div className="landing-home relative flex min-h-screen flex-col bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="min-w-0 flex-1 pt-14">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
