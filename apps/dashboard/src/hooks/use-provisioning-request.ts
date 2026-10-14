import { useRef } from "react";

import { useCurrentUser } from "@/hooks/auth/session";
import {
  completeProvisioningRequest,
  prepareProvisioningRequest,
} from "@/lib/provisioning-request";
import { showErrorToast } from "@/lib/toasts";

export function useProvisioningRequest(purpose: "wallet-root" | "session") {
  const user = useCurrentUser();
  const attempt = useRef<Awaited<ReturnType<typeof prepareProvisioningRequest>> | undefined>(
    undefined,
  );
  return {
    prepare: async (request: unknown) => {
      if (!user.data) throw new Error("Sign in before creating a managed resource");
      attempt.current = await prepareProvisioningRequest(
        `${user.data.organization.id}:${user.data.user.id}:${purpose}`,
        request,
      );
      return attempt.current.idempotencyKey;
    },
    complete: (idempotencyKey: string | undefined) => {
      if (attempt.current?.idempotencyKey === idempotencyKey && attempt.current) {
        try {
          completeProvisioningRequest(attempt.current);
        } catch (error) {
          showErrorToast(error, { title: "Created, but retry storage could not be cleared" });
        }
        attempt.current = undefined;
      }
    },
  };
}
