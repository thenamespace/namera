import { useRef, useState } from "react";

import { joinWaitlist, WaitlistRequestError } from "#/lib/waitlist";

import type { WaitlistFormOutput } from "./waitlist-schema";

export function useJoinWaitlist(options: {
  readonly onSuccess: (email: string) => void;
  readonly onError: (message: string) => void;
}) {
  const pending = useRef(false);
  const [isPending, setPending] = useState(false);

  const mutate = async (payload: WaitlistFormOutput) => {
    if (pending.current) return;
    pending.current = true;
    setPending(true);
    try {
      await joinWaitlist(payload, import.meta.env.VITE_API_URL || "https://api.namera.ai");
      options.onSuccess(payload.email);
    } catch (error) {
      options.onError(
        error instanceof WaitlistRequestError
          ? error.message
          : "Could not join the waitlist. Please try again.",
      );
    } finally {
      pending.current = false;
      setPending(false);
    }
  };

  return { mutate, isPending };
}
