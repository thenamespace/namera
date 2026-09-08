import { Button, Typography } from "@namera-ai/ui";

const reloadPage = () => window.location.reload();
const openOverview = () => window.location.assign("/");

function RouteFailure({ notFound = false }: { readonly notFound?: boolean }) {
  return (
    <section
      className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center"
      aria-labelledby="route-failure-title"
    >
      <Typography.Heading id="route-failure-title" level={1} className="text-lg" weight="medium">
        {notFound ? "Page not found" : "Couldn’t load this page"}
      </Typography.Heading>
      <Typography.Paragraph color="muted" size="sm" className="max-w-sm">
        {notFound
          ? "This page may have moved, or the item is no longer available."
          : "Check your connection and reload to try again."}
      </Typography.Paragraph>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {!notFound && (
          <Button variant="secondary" onPress={reloadPage}>
            Reload page
          </Button>
        )}
        <Button variant="tertiary" onPress={openOverview}>
          Go to overview
        </Button>
      </div>
    </section>
  );
}

// Do not render router error messages: they can contain request URLs or details
// from provider failures. Reload also clears failed atom results before retrying.
export function RouterError() {
  return <RouteFailure />;
}

export function RouterNotFound() {
  return <RouteFailure notFound />;
}
