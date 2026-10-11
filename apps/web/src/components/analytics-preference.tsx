import { useSyncExternalStore } from "react";

import { analyticsDisabled, setAnalyticsDisabled } from "@namera-ai/telemetry/analytics/browser";

const subscribe = () => () => {};
const serverSnapshot = () => false;

export function AnalyticsPreference() {
  const disabled = useSyncExternalStore(subscribe, analyticsDisabled, serverSnapshot);
  return (
    <button
      type="button"
      className="text-xs text-muted underline focus-visible:outline-2"
      onClick={() => {
        setAnalyticsDisabled(!disabled);
        window.location.reload();
      }}
    >
      {disabled ? "Enable analytics" : "Disable analytics"}
    </button>
  );
}
