import { DateTime, Schema } from "effect";

import { pack1271Signature } from "@alchemy/smart-accounts";
import { CompleteSignatureRequest, type PrepareSignatureRequest } from "@namera-ai/protocol/dto";
import { verifyTypedData } from "viem";

import { failure } from "#/result";
import type { LocalSessionSigner, ResolveSessionSigner } from "#/signing/local-session";
import { validateLocalSignature } from "#/signing/signature-validation";
import type { NameraTransport } from "#/transport";

export class SignatureClient {
  constructor(
    private readonly transport: NameraTransport,
    private readonly resolveSigner?: ResolveSessionSigner,
  ) {}

  prepare(request: PrepareSignatureRequest) {
    const headers = { "idempotency-key": globalThis.crypto.randomUUID() };
    return this.transport.requestWithRetry(
      request.type === "message"
        ? this.transport.client.signature.prepare({ payload: request, headers })
        : this.transport.client.signature.prepare({ payload: request, headers }),
    );
  }

  complete(request: CompleteSignatureRequest) {
    return this.transport.requestWithRetry(
      this.transport.client.signature.complete({ payload: request }),
    );
  }

  async sign(request: PrepareSignatureRequest) {
    if (this.resolveSigner === undefined)
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNER_REQUIRED",
        message: "Configure a local session signer before signing.",
        status: null,
        cause: null,
      });
    let signer: LocalSessionSigner;
    try {
      signer = await this.resolveSigner(request);
    } catch {
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNER_UNAVAILABLE",
        message: "The local session signer could not be opened.",
        status: null,
        cause: null,
      });
    }
    if (signer.signTypedData === undefined || signer.binding.allowSignatures !== true)
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNER_REQUIRED",
        message: "This local session has no approved signature capability.",
        status: null,
        cause: null,
      });

    const prepared = await this.prepare(request);
    if (!prepared.success) return prepared;
    let challenge: ReturnType<typeof validateLocalSignature>;
    try {
      challenge = validateLocalSignature({
        request,
        response: prepared.data,
        binding: signer.binding,
        now: DateTime.nowUnsafe(),
      });
    } catch {
      return failure({
        kind: "signer",
        code: "PREPARED_SIGNATURE_INVALID",
        message: "The prepared signature does not match the local session or requested payload.",
        status: null,
        cause: null,
      });
    }

    let completion: CompleteSignatureRequest;
    try {
      const signature = await signer.signTypedData(challenge);
      completion = Schema.decodeUnknownSync(CompleteSignatureRequest)({
        namespace: "eip155",
        operationId: prepared.data.operationId,
        signature,
      });
      if (
        !(await verifyTypedData({ ...challenge, signature, address: signer.binding.signerAddress }))
      )
        throw new Error("Wrong local signer");
      validateLocalSignature({
        request,
        response: prepared.data,
        binding: signer.binding,
        now: DateTime.nowUnsafe(),
      });
    } catch {
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNATURE_INVALID",
        message: "The local session could not produce a valid, unexpired signature.",
        status: null,
        cause: null,
      });
    }
    // Retries reuse this exact signature; they never invoke the local signer again.
    const completed = await this.complete(completion);
    if (!completed.success) return completed;
    const expected = pack1271Signature({
      entityId: signer.binding.entityId,
      validationSignaturePrefix: "0x00",
      validationSignature: completion.signature,
    });
    if (
      completed.data.walletId !== request.walletId ||
      completed.data.chainId !== request.chainId ||
      completed.data.type !== request.type ||
      completed.data.account.toLowerCase() !== signer.binding.walletAddress.toLowerCase() ||
      completed.data.signature.toLowerCase() !== expected.toLowerCase()
    )
      return failure({
        kind: "signer",
        code: "LOCAL_SIGNATURE_INVALID",
        message: "The returned signature does not match the completed local operation.",
        status: null,
        cause: null,
      });
    return completed;
  }
}
