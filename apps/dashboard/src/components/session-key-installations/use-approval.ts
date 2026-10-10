import { useEffect, useRef, useState } from "react";

import { DateTime, Effect } from "effect";

import type {
  CompleteSessionKeyOperationRequest,
  GetWalletPasskeyOwnerResponse,
  PrepareSessionKeyOperationRequest,
  PrepareSessionKeyOperationResponse,
  PrepareManagedSessionKeyOperationResponse,
  SessionKeyResponse,
} from "@namera-ai/protocol/dto";
import { validateOwnerApproval } from "@namera-ai/sdk";
import { startAuthentication } from "@simplewebauthn/browser";

import { env } from "@/env";
import { useCompleteSessionKeyOperation, usePrepareSessionKeyOperation } from "@/hooks/session-key";
import {
  usePrepareManagedSessionKeyOperation,
  useApproveManagedSessionKeyOperation,
} from "@/hooks/session-key/operation";
import { isOneClawAccount } from "@/lib/session-owner";
import { showErrorToast } from "@/lib/toasts";

import { confirmManagedApproval } from "./confirm-managed-approval";
import { reviewSessionInstallation, reviewManagedSessionInstallation } from "./review";

export function useInstallationApproval(
  session: SessionKeyResponse,
  installation: SessionKeyResponse["installations"][number],
  descriptor: GetWalletPasskeyOwnerResponse | undefined,
  kind: "install" | "uninstall",
) {
  const prepare = usePrepareSessionKeyOperation();
  const complete = useCompleteSessionKeyOperation();
  const prepareManaged = usePrepareManagedSessionKeyOperation();
  const approveManaged = useApproveManagedSessionKeyOperation();
  const managed = isOneClawAccount(session.wallet);
  const confirmation = useRef<((confirmed: boolean) => void) | undefined>(undefined);
  const [reviewOpen, setReviewOpen] = useState(false);
  const confirm = (confirmed: boolean) => {
    setReviewOpen(false);
    confirmation.current?.(confirmed);
    confirmation.current = undefined;
  };
  const attempt = useRef<
    | {
        key: string;
        prepared?: PrepareSessionKeyOperationResponse;
        assertion?: CompleteSessionKeyOperationRequest;
        managedPrepared?: PrepareManagedSessionKeyOperationResponse;
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
      confirmation.current?.(false);
    },
    [],
  );

  const approve = async (recovered?: PrepareSessionKeyOperationRequest) => {
    if (busy.current || (!managed && !descriptor)) return;
    // The dashboard currently reviews sponsored approvals only. Never silently
    // change a recovered self-funded request or resume a different installation.
    if (
      recovered &&
      (!recovered.sponsor ||
        recovered.installationId !== installation.id ||
        recovered.kind !== kind)
    )
      return;
    busy.current = true;
    setPending(true);
    setError(false);
    const abort = new AbortController();
    controller.current = abort;
    try {
      const current = (attempt.current ??= {
        key: recovered?.idempotencyKey ?? crypto.randomUUID(),
      });
      if (managed) {
        const reviewed = await reviewManagedSessionInstallation(
          session.wallet,
          installation,
          kind,
          abort.signal,
          env.backendUrl,
        );
        if (abort.signal.aborted) return;
        current.managedPrepared ??= await prepareManaged.mutateAsync({
          payload: {
            installationId: installation.id,
            kind,
            idempotencyKey: current.key,
            sponsor: true,
          },
        });
        if (abort.signal.aborted) return;
        const response = current.managedPrepared;
        setOperationId(response.operationId);
        const confirmed = await confirmManagedApproval({
          reviewed,
          response,
          signal: abort.signal,
          requestConfirmation: () =>
            new Promise<boolean>((resolve) => {
              confirmation.current = resolve;
              setReviewOpen(true);
            }),
          approve: (payload) => approveManaged.mutateAsync({ payload }),
        });
        if (abort.signal.aborted) return;
        if (!confirmed) setError(true);
        return;
      }
      if (!descriptor) return;
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
          title:
            kind === "uninstall"
              ? "Couldn’t remove onchain permissions"
              : "Couldn’t approve this network",
          description:
            kind === "uninstall"
              ? "API access remains revoked. Retry here to resume removal safely."
              : "Retry here to resume the same approval safely.",
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
  return { approve, pending, operationId, error, finish, reviewOpen, confirm };
}
