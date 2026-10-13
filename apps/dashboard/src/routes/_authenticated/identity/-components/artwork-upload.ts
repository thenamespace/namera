// Each upload has a single-use authorization; serialize passkey prompts and record saves.
// oxlint-disable eslint/no-await-in-loop
import { DateTime } from "effect";

import { ownerMessageChallenge } from "@namera-ai/evm/signature-review";
import type {
  WalletResponse,
  GetWalletPasskeyOwnerResponse,
  PrepareWalletSignatureResponse,
  CompleteWalletSignatureResponse,
  CompleteWalletSignatureRequest,
} from "@namera-ai/protocol/dto";

import { isOneClawAccount } from "@/lib/session-owner";

import { IdentityArtworkError, type ArtworkDraft, type ArtworkKind } from "./artwork-schema";

export type UploadedArtwork = Partial<Record<ArtworkKind, { file: File; url: string }>>;
export type ArtworkProgress = "Preparing…" | "Signing…" | "Uploading…" | "Saving…";

const invalid = () => {
  throw new IdentityArtworkError({ code: "APPROVAL_INVALID" });
};

export function validateArtworkApproval(
  wallet: WalletResponse,
  message: string,
  prepared: PrepareWalletSignatureResponse,
  descriptor?: GetWalletPasskeyOwnerResponse,
) {
  if (
    prepared.walletId !== wallet.id ||
    prepared.signingKeyId !== wallet.owner.signingKeyId ||
    prepared.account.toLowerCase() !== wallet.address.toLowerCase() ||
    prepared.namespace !== "eip155" ||
    prepared.request.namespace !== "eip155" ||
    prepared.request.chainId !== "eip155:1" ||
    prepared.request.type !== "message" ||
    prepared.request.message !== message ||
    DateTime.toEpochMillis(prepared.expiresAt) <= Date.now()
  )
    invalid();
  if (isOneClawAccount(wallet)) {
    if (prepared.signing.method !== "server") invalid();
    return;
  }
  if (prepared.signing.method !== "passkey") return invalid();
  const owner = descriptor?.owner;
  const options = prepared.signing.options;
  if (
    !owner ||
    descriptor?.walletId !== wallet.id ||
    owner.signingKeyId !== wallet.owner.signingKeyId ||
    options.rpId !== owner.rpId ||
    options.userVerification !== "required" ||
    options.allowCredentials.length !== 1 ||
    options.allowCredentials[0]?.id !== owner.credentialId ||
    options.challenge !== ownerMessageChallenge(wallet.address, 1, message)
  )
    invalid();
}

type UploadDependencies = {
  assertActive: () => void;
  progress: (stage: ArtworkProgress) => void;
  authorize: (kind: ArtworkKind) => Promise<{ message: string; expiresAt: number }>;
  prepare: (message: string) => Promise<PrepareWalletSignatureResponse>;
  authenticate: (
    options: Extract<PrepareWalletSignatureResponse["signing"], { method: "passkey" }>["options"],
  ) => Promise<NonNullable<CompleteWalletSignatureRequest["response"]>>;
  complete: (payload: CompleteWalletSignatureRequest) => Promise<CompleteWalletSignatureResponse>;
  upload: (kind: ArtworkKind, file: File, message: string, signature: string) => Promise<string>;
  save: (kind: ArtworkKind, url: string) => Promise<unknown>;
  saved: (kind: ArtworkKind, file: File, url: string) => void;
};

/** Uploads are retained across record failures; completed fields are cleared independently. */
export async function saveArtwork(
  draft: ArtworkDraft,
  uploaded: UploadedArtwork,
  wallet: WalletResponse,
  descriptor: GetWalletPasskeyOwnerResponse | undefined,
  deps: UploadDependencies,
) {
  for (const kind of ["avatar", "header"] as const) {
    const file = draft[kind];
    if (!file) continue;
    deps.assertActive();
    let url = uploaded[kind]?.file === file ? uploaded[kind]?.url : undefined;
    if (!url) {
      deps.progress("Preparing…");
      const authorization = await deps.authorize(kind);
      deps.assertActive();
      const prepared = await deps.prepare(authorization.message);
      deps.assertActive();
      validateArtworkApproval(wallet, authorization.message, prepared, descriptor);
      if (authorization.expiresAt <= Date.now())
        throw new IdentityArtworkError({ code: "AUTHORIZATION_EXPIRED" });
      deps.progress("Signing…");
      const response =
        prepared.signing.method === "passkey"
          ? await deps.authenticate(prepared.signing.options)
          : undefined;
      deps.assertActive();
      const signed = await deps.complete({
        namespace: "eip155",
        operationId: prepared.operationId,
        ...(response ? { response } : {}),
      });
      deps.assertActive();
      if (
        signed.operationId !== prepared.operationId ||
        signed.walletId !== wallet.id ||
        signed.namespace !== "eip155" ||
        signed.chainId !== "eip155:1" ||
        signed.type !== "message" ||
        signed.account.toLowerCase() !== wallet.address.toLowerCase()
      )
        throw new IdentityArtworkError({ code: "APPROVAL_INVALID" });
      if (authorization.expiresAt <= Date.now())
        throw new IdentityArtworkError({ code: "AUTHORIZATION_EXPIRED" });
      deps.progress("Uploading…");
      url = await deps.upload(kind, file, authorization.message, signed.signature);
      deps.assertActive();
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch {
        throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
      }
      if (parsed.protocol !== "https:" || parsed.username || parsed.password)
        throw new IdentityArtworkError({ code: "UPLOAD_FAILED" });
      uploaded[kind] = { file, url };
    }
    deps.progress("Saving…");
    await deps.save(kind, url);
    deps.assertActive();
    deps.saved(kind, file, url);
    delete uploaded[kind];
  }
}
