import { useEffect, useRef, useState } from "react";

import { DateTime, Effect } from "effect";

import type {
  CompleteSessionKeyOperationRequest,
  GetWalletPasskeyOwnerResponse,
  PrepareSessionKeyOperationResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";
import { validateOwnerApproval } from "@namera-ai/sdk";
import { startAuthentication } from "@simplewebauthn/browser";

import { env } from "@/env";
import { useCompleteSessionKeyOperation, usePrepareSessionKeyOperation } from "@/hooks/session-key";
import { showErrorToast } from "@/lib/toasts";

import { reviewSessionInstallation } from "./review";

export function useInstallationApproval(
  session: SessionKeyResponse,
  installation: SessionKeyResponse["installations"][number],
  descriptor: GetWalletPasskeyOwnerResponse | undefined,
  kind: "install" | "uninstall",
) {
  const prepare = usePrepareSessionKeyOperation();
  const complete = useCompleteSessionKeyOperation();
  const attempt = useRef<
    | {
        key: string;
        prepared?: PrepareSessionKeyOperationResponse;
        assertion?: CompleteSessionKeyOperationRequest;
      }
    | undefined
  >(undefined);
  const controller = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [operationId, setOperationId] =
    useState<PrepareSessionKeyOperationResponse["operationId"]>();
  const [error, setError] = useState(false);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );

  const approve = async () => {
    if (busy.current || !descriptor) return;
    busy.current = true;
    setPending(true);
    setError(false);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const current = (attempt.current ??= { key: crypto.randomUUID() });
      if (!current.assertion) {
        const reviewed = await reviewSessionInstallation(
          session.wallet,
          installation,
          descriptor,
          kind,
          abort.signal,
          env.backendUrl,
        );
        if (abort.signal.aborted) return;
        current.prepared ??= await prepare.mutateAsync({
          payload: {
            installationId: installation.id,
            kind,
            idempotencyKey: current.key,
            sponsor: true,
          },
        });
        if (abort.signal.aborted) return;
        setOperationId(current.prepared.operationId);
        validateOwnerApproval({
          reviewed,
          response: current.prepared,
          now: Effect.runSync(DateTime.now),
        });
        const assertion = await startAuthentication({
          optionsJSON: {
            ...current.prepared.options,
            allowCredentials: current.prepared.options.allowCredentials.map((credential) => ({
              id: credential.id,
              type: credential.type,
            })),
          },
        });
        if (abort.signal.aborted) return;
        current.assertion = { operationId: current.prepared.operationId, response: assertion };
      }
      await complete.mutateAsync({ payload: current.assertion });
    } catch (cause) {
      if (!abort.signal.aborted) {
        setError(true);
        showErrorToast(cause, {
          title: "Couldn’t approve this network",
          description: "Retry here to resume the same approval safely.",
        });
      }
    } finally {
      busy.current = false;
      if (!abort.signal.aborted) setPending(false);
    }
  };
  const finish = () => {
    attempt.current = undefined;
    setOperationId(undefined);
  };
  return { approve, pending, operationId, error, finish };
}
