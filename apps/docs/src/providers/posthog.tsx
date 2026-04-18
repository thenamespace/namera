import { PostHogProvider as PostHogProviderCore } from "@posthog/react";

import { env } from "@/lib/env";

export const PostHogProvider = ({ children }: React.PropsWithChildren) => {
  if (!env.postHogToken || !env.postHogHost) return children;

  return (
    <PostHogProviderCore
      apiKey={env.postHogToken}
      options={{
        api_host: "/api/ph",
        capture_exceptions: true,
        defaults: "2025-05-24",
        ui_host: env.postHogHost,
      }}
    >
      {children}
    </PostHogProviderCore>
  );
};
