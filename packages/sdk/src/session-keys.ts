import type { SessionKeyId, WalletId } from "@namera-ai/protocol";

import type { NameraTransport } from "#/transport";

export type ListSessionKeysOptions = {
  readonly walletId?: WalletId;
};

export class SessionKeyClient {
  constructor(private readonly transport: NameraTransport) {}

  list(options: ListSessionKeysOptions = {}) {
    return options.walletId === undefined
      ? this.transport.request(this.transport.client.sessionKey.listForOrganization())
      : this.transport.request(
          this.transport.client.sessionKey.listForWallet({
            params: { walletId: options.walletId },
          }),
        );
  }

  get(sessionKeyId: SessionKeyId) {
    return this.transport.request(
      this.transport.client.sessionKey.get({ params: { sessionKeyId } }),
    );
  }
}
