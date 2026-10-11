import { SessionKeyId, WalletId } from "@namera-ai/protocol";

import { inputDecoder } from "#/input-validation";
import type { ListSessionKeysOptions } from "#/inputs";
import type { NameraTransport } from "#/transport";

export type { ListSessionKeysOptions } from "#/inputs";

const decodeWalletId = inputDecoder(WalletId);
const decodeSessionKeyId = inputDecoder(SessionKeyId);

export class SessionKeyClient {
  constructor(private readonly transport: NameraTransport) {}

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
