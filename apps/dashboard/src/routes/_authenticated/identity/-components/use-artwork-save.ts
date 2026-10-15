import { useContext, useEffect, useRef, useState } from "react";

import { RegistryContext } from "@effect/atom-react";

import type { EnsLabel } from "@namera-ai/protocol";
import type { WalletResponse } from "@namera-ai/protocol/dto";
import { startAuthentication } from "@simplewebauthn/browser";

import { canSaveInAuthority, sessionAuthority } from "@/atoms/auth/authority";
import { currentUserAtom } from "@/atoms/auth/session";
import { useUpdateIdentityRecords } from "@/hooks/identity";
import { useWalletPasskeyOwner } from "@/hooks/wallet";
import { usePrepareWalletSignature, useCompleteWalletSignature } from "@/hooks/wallet/signature";
import { queryData } from "@/lib/query-data";
import { isOneClawAccount } from "@/lib/session-owner";
import { showErrorToast, showSuccessToast } from "@/lib/toasts";

import type { ArtworkDraft, ArtworkKind } from "./artwork-schema";
import { saveArtwork, type ArtworkProgress, type UploadedArtwork } from "./artwork-upload";
import { authorizeArtwork, uploadArtwork } from "./namespace-artwork";

export function useArtworkSave(
  wallet: WalletResponse,
  label: EnsLabel,
  saved: (kind: ArtworkKind, file: File, url: string) => void,
) {
  const registry = useContext(RegistryContext);
  const authority = useRef(sessionAuthority(queryData(registry.get(currentUserAtom))));
  const mounted = useRef(false);
  const busy = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const uploaded = useRef<UploadedArtwork>({});
  const [progress, setProgress] = useState<ArtworkProgress | null>(null);
  const prepare = usePrepareWalletSignature();
  const complete = useCompleteWalletSignature();
  const update = useUpdateIdentityRecords();
  const descriptor = useWalletPasskeyOwner(wallet.id);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort();
    };
  }, []);

  const active = () =>
    mounted.current &&
    canSaveInAuthority(
      authority.current,
      sessionAuthority(queryData(registry.get(currentUserAtom))),
    );

  const assertActive = () => {
    if (!active()) throw new DOMException("Editing context changed", "AbortError");
  };

  const run = async (draft: ArtworkDraft) => {
    if (busy.current || !active()) return false;

    busy.current = true;
    const controller = new AbortController();
    abort.current = controller;
    setProgress("Preparing…");

    try {
      assertActive();
      await saveArtwork(draft, uploaded.current, wallet, descriptor.data, {
        assertActive,
        progress: setProgress,
        authorize: (kind) =>
          authorizeArtwork(kind, wallet.address, window.location.origin, controller.signal),
        prepare: (message) =>
          prepare.mutateAsync({
            params: { walletId: wallet.id },
            headers: { "idempotency-key": crypto.randomUUID() },
            payload: { namespace: "eip155", chainId: "eip155:1", type: "message", message },
          }),
        authenticate: (options) =>
          startAuthentication({
            optionsJSON: {
              ...options,
              allowCredentials: options.allowCredentials.map(({ id, type }) => ({ id, type })),
            },
          }),
        complete: (payload) => complete.mutateAsync({ params: { walletId: wallet.id }, payload }),
        upload: (kind, file, message, signature) =>
          uploadArtwork(
            kind,
            file,
            `${label}.namera.id`,
            wallet.address,
            message,
            signature,
            controller.signal,
          ),
        save: (kind, url) =>
          update.mutateAsync({
            params: { walletId: wallet.id, label },
            payload: { changes: [{ type: "text", key: kind, value: url }] },
          }),
        saved,
      });

      showSuccessToast({ title: "Profile images saved" });
      return true;
    } catch (error) {
      if (active()) {
        showErrorToast(error, {
          title: "Couldn’t save profile images",
          description: "Your changes are kept here. Try again when you’re ready.",
        });
      }

      return false;
    } finally {
      busy.current = false;
      if (active()) setProgress(null);
    }
  };

  return {
    run,
    progress,
    ready: isOneClawAccount(wallet) || Boolean(descriptor.data),
    approvalError: !isOneClawAccount(wallet) && descriptor.isError,
    retryApproval: descriptor.refetch,
  };
}
