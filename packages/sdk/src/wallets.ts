import { WalletId } from "@namera-ai/protocol";

import { inputDecoder } from "#/input-validation";
import type { NameraTransport } from "#/transport";

const decodeWalletId = inputDecoder(WalletId);

export class WalletClient {
  constructor(private readonly transport: NameraTransport) {}

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
