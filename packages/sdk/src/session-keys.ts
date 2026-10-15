import { SessionKeyId, SessionKeyOperationId, WalletId } from "@namera-ai/protocol";
import { CreateSessionKeyRequest } from "@namera-ai/protocol/dto";

import { inputDecoder } from "#/input-validation";
import type * as Input from "#/inputs";
import type { ListSessionKeysOptions } from "#/inputs";
import type { NameraTransport } from "#/transport";

import {
  prepareSessionKeyOperation,
  recoverSessionKeyOperation,
  approveSessionKeyOperation,
} from "./session-key-operations.js";

export type { ListSessionKeysOptions } from "#/inputs";

const decodeCreate = inputDecoder(CreateSessionKeyRequest);
const decodeOperationId = inputDecoder(SessionKeyOperationId);
const decodeWalletId = inputDecoder(WalletId);
const decodeSessionKeyId = inputDecoder(SessionKeyId);

export class SessionKeyClient {
  constructor(private readonly transport: NameraTransport) {}

  async create(input: Input.CreateSessionKeyRequest) {
    const decoded = decodeCreate({ ...input, idempotencyKey: globalThis.crypto.randomUUID() });
    if (!decoded.success) return decoded;
    const request = this.transport.client.sessionKey.create({ payload: decoded.data });
    return decoded.data.signer.custody === "namera-managed"
      ? this.transport.requestWithRetry(request)
      : this.transport.request(request);
  }

  async revoke(sessionKeyId: string) {
    const decoded = decodeSessionKeyId(sessionKeyId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.sessionKey.revoke({ params: { sessionKeyId: decoded.data } }),
    );
  }

  prepareOperation(input: Input.PrepareSessionKeyOperationRequest) {
    return prepareSessionKeyOperation(this.transport, input);
  }

  approveOperation(input: Input.ApproveSessionKeyOperationRequest) {
    return approveSessionKeyOperation(this.transport, input);
  }

  getActiveOperation(input: Input.SessionKeyOperationTarget) {
    return recoverSessionKeyOperation(this.transport, input);
  }

  async getOperation(operationId: string) {
    const decoded = decodeOperationId(operationId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.sessionKey.getOperation({ params: { operationId: decoded.data } }),
    );
  }

  async cancelOperation(operationId: string) {
    const decoded = decodeOperationId(operationId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.sessionKey.cancelOperation({ params: { operationId: decoded.data } }),
    );
  }

  async list(options: ListSessionKeysOptions = {}) {
    if (options.walletId === undefined)
      return this.transport.request(this.transport.client.sessionKey.listForOrganization());
    const decoded = decodeWalletId(options.walletId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.sessionKey.listForWallet({ params: { walletId: decoded.data } }),
    );
  }

  async get(sessionKeyId: string) {
    const decoded = decodeSessionKeyId(sessionKeyId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.sessionKey.get({ params: { sessionKeyId: decoded.data } }),
    );
  }
}
