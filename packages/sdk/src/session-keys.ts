import type { SessionKeyId, WalletId } from "@namera-ai/protocol";
import {
  type GetSessionKeyResponse as GetSessionKeyResponseType,
  type ListSessionKeysForOrganizationResponse as ListSessionKeysForOrganizationResponseType,
  type ListSessionKeysForWalletResponse as ListSessionKeysForWalletResponseType,
} from "@namera-ai/protocol/dto";

import type { NameraResult } from "#/result";
import type { NameraTransport } from "#/transport";

export class SessionKeyClient {
  constructor(private readonly transport: NameraTransport) {}

  list(): Promise<NameraResult<ListSessionKeysForOrganizationResponseType>> {
    return this.transport.request(this.transport.client.sessionKey.listForOrganization());
  }

  listForWallet(walletId: WalletId): Promise<NameraResult<ListSessionKeysForWalletResponseType>> {
    return this.transport.request(
      this.transport.client.sessionKey.listForWallet({ params: { walletId } }),
    );
  }

  get(sessionKeyId: SessionKeyId): Promise<NameraResult<GetSessionKeyResponseType>> {
    return this.transport.request(
      this.transport.client.sessionKey.get({ params: { sessionKeyId } }),
    );
  }
}
