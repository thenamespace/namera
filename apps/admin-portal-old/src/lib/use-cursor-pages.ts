import { useCallback, useState } from "react";

/**
 * Keyset paging only moves forward, so going back means remembering the cursor
 * that produced each page. A cursor from one filter does not describe a
 * position in another, so callers reset the stack when a filter changes.
 */
export const useCursorPages = () => {
  const [stack, setStack] = useState<ReadonlyArray<string>>([]);

  const cursor = stack.at(-1);
  const push = useCallback((next: string) => setStack((current) => [...current, next]), []);
  const pop = useCallback(() => setStack((current) => current.slice(0, -1)), []);
  const reset = useCallback(() => setStack([]), []);

  return { canGoBack: stack.length > 0, cursor, push, pop, reset };
};
