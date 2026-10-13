import { useEffect, useRef, useState } from "react";

import { DateTime, Effect } from "effect";

import { getChainDataByCaip2 } from "@namera-ai/evm/chains";
import type { EnsLabel } from "@namera-ai/protocol";
import type {
  ApproveIdentityPrimaryRequest,
  GetWalletPasskeyOwnerResponse,
  PrepareIdentityPrimaryResponse,
  WalletResponse,
} from "@namera-ai/protocol/dto";
import { startAuthentication } from "@simplewebauthn/browser";
import { createPublicClient, http } from "viem";

import { env } from "@/env";
import { useApproveIdentityPrimary, usePrepareIdentityPrimary } from "@/hooks/identity";
import { isOneClawAccount } from "@/lib/session-owner";
import { showErrorToast } from "@/lib/toasts";

export function usePrimaryApproval(
  wallet: WalletResponse,
  label: EnsLabel,
  descriptor: GetWalletPasskeyOwnerResponse | undefined,
  refresh: () => void,
  terminalOperationId: string | undefined,
) {
  const prepare = usePrepareIdentityPrimary();
  const approve = useApproveIdentityPrimary();
  const [pending, setPending] = useState(false);
  const [reviewFee, setReviewFee] = useState<bigint>();
  const confirm = useRef<((accepted: boolean) => void) | undefined>(undefined);
  const attempt = useRef<
    | {
        key: string;
        prepared?: PrepareIdentityPrimaryResponse;
        assertion?: ApproveIdentityPrimaryRequest;
      }
    | undefined
  >(undefined);
  const abort = useRef<AbortController | undefined>(undefined);
  const busy = useRef(false);
  useEffect(() => {
    if (terminalOperationId && attempt.current?.prepared?.operationId === terminalOperationId)
      attempt.current = undefined;
  }, [terminalOperationId]);
  useEffect(
    () => () => {
      abort.current?.abort();
      confirm.current?.(false);
    },
    [],
  );
  const answer = (accepted: boolean) => {
    setReviewFee(undefined);
    confirm.current?.(accepted);
    confirm.current = undefined;
  };
  const start = async (retryKey: string | null) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const managed = isOneClawAccount(wallet);
      const owner = descriptor?.owner;
      if (
        !managed &&
        (!owner ||
          descriptor?.walletId !== wallet.id ||
          owner.signingKeyId !== wallet.owner.signingKeyId)
      )
        throw new Error("Passkey owner unavailable");
      const current = (attempt.current ??= { key: retryKey ?? crypto.randomUUID() });
      if (!current.assertion) {
        const chain = getChainDataByCaip2("eip155:1");
        if (!chain) throw new Error("Ethereum unavailable");
        const { reviewPrimaryName, validatePrimaryApproval } =
          await import("@namera-ai/evm/identity-review");
        const reviewed = await reviewPrimaryName(
          {
            wallet: {
              ...wallet.data,
              address: wallet.address,
              implementation: wallet.implementation,
            },
            name: `${label}.namera.id`,
            ...(!managed && owner
              ? {
                  owner: {
                    publicKey: owner.publicKeyHex,
                    credentialId: owner.credentialId,
                    rpId: owner.rpId,
                  },
                }
              : {}),
          },
          createPublicClient({
            chain: chain.chain,
            transport: http(`${env.backendUrl}/rpc/eip155/1`),
          }),
        );
        if (controller.signal.aborted) return;
        current.prepared ??= await prepare.mutateAsync({
          params: { walletId: wallet.id, label },
          payload: { idempotencyKey: current.key },
        });
        if (controller.signal.aborted) return;
        const response = current.prepared;
        const operation = response.prepared.userOperation;
        const fee =
          (operation.callGasLimit + operation.verificationGasLimit + operation.preVerificationGas) *
          operation.maxFeePerGas;
        validatePrimaryApproval(reviewed, response, fee, Effect.runSync(DateTime.now));
        const accepted = await new Promise<boolean>((resolve) => {
          confirm.current = resolve;
          setReviewFee(fee);
        });
        if (!accepted || controller.signal.aborted) return;
        validatePrimaryApproval(reviewed, response, fee, Effect.runSync(DateTime.now));
        if (response.approval === "passkey") {
          if (!response.options) throw new Error("Missing passkey challenge");
          const assertion = await startAuthentication({
            optionsJSON: {
              ...response.options,
              allowCredentials: response.options.allowCredentials.map(({ id, type }) => ({
                id,
                type,
              })),
            },
          });
          if (controller.signal.aborted) return;
          current.assertion = { operationId: response.operationId, response: assertion };
        } else current.assertion = { operationId: response.operationId };
      }
      await approve.mutateAsync({
        params: { walletId: wallet.id, label },
        payload: current.assertion,
      });
      attempt.current = undefined;
    } catch (error) {
      if (!controller.signal.aborted) {
        // Expired, unsigned preparations need a new key. Signed retries retain the exact assertion.
        const current = attempt.current;
        if (
          current?.prepared &&
          !current.assertion &&
          DateTime.toEpochMillis(current.prepared.expiresAt) <= Date.now()
        )
          attempt.current = undefined;
        showErrorToast(error, {
          title: "Couldn’t set primary name",
          description: "Retry to resume your approval safely.",
        });
      }
    } finally {
      busy.current = false;
      if (!controller.signal.aborted) {
        setPending(false);
        refresh();
      }
    }
  };
  return { start, pending, reviewFee, answer };
}
