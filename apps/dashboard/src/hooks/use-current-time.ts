import { useState } from "react";

import { useInterval } from "usehooks-ts";

/** Minute-resolution time for date filters and expiration labels, not authorization. */
export function useCurrentTime() {
  const [now, setNow] = useState(Date.now);
  useInterval(() => setNow(Date.now()), 60_000);
  return now;
}
