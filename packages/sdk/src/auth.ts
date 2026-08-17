import type { NameraTransport } from "#/transport";

export class AuthClient {
  constructor(private readonly transport: NameraTransport) {}

  currentActor() {
    return this.transport.request(this.transport.client.session.currentActor());
  }
}
