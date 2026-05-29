import { Effect } from "effect";

export const annotateDashboardRoute = () =>
  Effect.annotateCurrentSpan({
    "app.route": window.location.pathname,
  });
