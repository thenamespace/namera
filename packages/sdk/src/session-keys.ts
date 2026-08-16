import type { SessionKeyId, WalletId } from "@namera-ai/protocol";

import type { NameraTransport } from "#/transport";

export class SessionKeyClient {
  constructor(private readonly transport: NameraTransport) {}

  list() {
    return this.transport.request(this.transport.client.sessionKey.listForOrganization());
  }

  listForWallet(walletId: WalletId) {
    return this.transport.request(
      this.transport.client.sessionKey.listForWallet({ params: { walletId } }),
    );
  }

  get(sessionKeyId: SessionKeyId) {
    return this.transport.request(
      this.transport.client.sessionKey.get({ params: { sessionKeyId } }),
    );
  }
}
