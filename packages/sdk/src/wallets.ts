import { Schema, Struct } from "effect";

import { WalletId } from "@namera-ai/protocol";
import {
  CreateWalletRequest,
  CreatePasskeyRegistrationOptionsRequest,
} from "@namera-ai/protocol/dto";

import { inputDecoder } from "#/input-validation";
import type * as Input from "#/inputs";
import type { NameraTransport } from "#/transport";

const decodeCreate = inputDecoder(CreateWalletRequest);
const decodeRegistration = inputDecoder(
  CreatePasskeyRegistrationOptionsRequest.mapFields(Struct.map(Schema.requiredKey)),
);
const decodeWalletId = inputDecoder(WalletId);

export class WalletClient {
  constructor(private readonly transport: NameraTransport) {}

  async create(input: Input.CreateWalletRequest) {
    const decoded = decodeCreate({ ...input, idempotencyKey: globalThis.crypto.randomUUID() });
    if (!decoded.success) return decoded;
    const request = this.transport.client.wallet.create({ payload: decoded.data });
    return decoded.data.owner.type === "namera-managed"
      ? this.transport.requestWithRetry(request)
      : this.transport.request(request);
  }

  async createPasskeyRegistrationOptions(input: Input.CreatePasskeyRegistrationOptionsRequest) {
    const decoded = decodeRegistration(input);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.wallet.createPasskeyRegistrationOptions({ payload: decoded.data }),
    );
  }

  async getPasskeyOwner(walletId: string) {
    const decoded = decodeWalletId(walletId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.wallet.getPasskeyOwner({ params: { walletId: decoded.data } }),
    );
  }

  list() {
    return this.transport.request(this.transport.client.wallet.list());
  }

  async get(walletId: string) {
    const decoded = decodeWalletId(walletId);
    if (!decoded.success) return decoded;
    return this.transport.request(
      this.transport.client.wallet.get({ params: { walletId: decoded.data } }),
    );
  }
}
