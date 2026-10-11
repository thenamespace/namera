import { useCallback, useState } from "react";

import { analyticsDisabled, setAnalyticsDisabled } from "@namera-ai/telemetry/analytics/browser";
import { Button } from "@namera-ai/ui";

export function AnalyticsPreference() {
  const [disabled] = useState(analyticsDisabled);
  const toggleAnalytics = useCallback(() => {
    setAnalyticsDisabled(!disabled);
    window.location.reload();
  }, [disabled]);
  return (
    <section className="mt-10 space-y-3" aria-labelledby="analytics-preference">
      <h2 id="analytics-preference" className="text-base font-medium">
        Product analytics
      </h2>
      <p className="text-sm text-muted">
        Help improve Namera with usage and performance data. Session recording is disabled. This
        preference applies to this browser.
      </p>
      <Button variant="secondary" onPress={toggleAnalytics}>
        {disabled ? "Enable analytics" : "Disable analytics"}
      </Button>
    </section>
  );
}
