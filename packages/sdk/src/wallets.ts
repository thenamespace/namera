import type { WalletId } from "@namera-ai/protocol";

import type { NameraTransport } from "#/transport";

export class WalletClient {
  constructor(private readonly transport: NameraTransport) {}

  list() {
    return this.transport.request(this.transport.client.wallet.list());
  }

  get(walletId: WalletId) {
    return this.transport.request(this.transport.client.wallet.get({ params: { walletId } }));
  }
}
