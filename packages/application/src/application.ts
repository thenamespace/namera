import { Context, Effect, Layer } from "effect";

import {
  makeAccountApplication,
  type SessionApplication,
  type UserApplication,
} from "#/auth/account/service";
import { makeMagicLinkApplication, type MagicLinkApplication } from "#/auth/magic-link/service";
import {
  makeOrganizationApplication,
  type OrganizationApplication,
} from "#/auth/organization/service";

export interface ApplicationService {
  readonly magicLink: MagicLinkApplication;
  readonly organization: OrganizationApplication;
  readonly session: SessionApplication;
  readonly user: UserApplication;
}

export class Application extends Context.Service<Application, ApplicationService>()(
  "@namera-ai/application/Application",
) {
  static readonly layer = Layer.effect(
    Application,
    Effect.gen(function* () {
      const account = yield* makeAccountApplication;
      const magicLink = yield* makeMagicLinkApplication;
      const organization = yield* makeOrganizationApplication;

      return Application.of({
        magicLink,
        organization,
        session: account.session,
        user: account.user,
      });
    }),
  );
}
