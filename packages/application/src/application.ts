import { Context, Effect, Layer } from "effect";

import { Audit } from "#/audit/layer";
import { makeSessionApplication, type SessionApplication } from "#/auth/core/session";
import { makeUserApplication, type UserApplication } from "#/auth/core/user";
import {
  makeRequestMagicLinkApplication,
  type RequestMagicLinkApplication,
} from "#/auth/magic-link/request";
import {
  makeVerifyMagicLinkApplication,
  type VerifyMagicLinkApplication,
} from "#/auth/magic-link/verify";
import {
  makeInvitationApplication,
  type InvitationApplication,
} from "#/auth/organization/invitation";
import { makeMemberApplication, type MemberApplication } from "#/auth/organization/member";
import {
  makeOrganizationApplication,
  type OrganizationApplication,
} from "#/auth/organization/organization";
import { makeBillingApplication, type BillingApplication } from "#/billing/index";
import { makeNotificationApplication, type NotificationApplication } from "#/notification/index";
import { makeSessionKeyApplication, type SessionKeyApplication } from "#/session-key/index";
import { makeWalletApplication, type WalletApplication } from "#/wallet/index";

export interface ApplicationService {
  readonly billing: BillingApplication;
  readonly magicLink: RequestMagicLinkApplication & VerifyMagicLinkApplication;
  readonly notification: NotificationApplication;
  readonly organization: OrganizationApplication & {
    readonly invitation: InvitationApplication;
    readonly member: MemberApplication;
  };
  readonly session: SessionApplication;
  readonly sessionKey: SessionKeyApplication;
  readonly user: UserApplication;
  readonly wallet: WalletApplication;
}

export class Application extends Context.Service<Application, ApplicationService>()(
  "@namera-ai/application/Application",
) {
  static readonly layer = Layer.effect(
    Application,
    Effect.gen(function* () {
      const session = yield* makeSessionApplication;
      const user = yield* makeUserApplication;
      const magicLinkRequest = yield* makeRequestMagicLinkApplication;
      const magicLinkVerify = yield* makeVerifyMagicLinkApplication;
      const organization = yield* makeOrganizationApplication;
      const invitation = yield* makeInvitationApplication;
      const member = yield* makeMemberApplication;
      const notification = yield* makeNotificationApplication;
      const billing = yield* makeBillingApplication;
      const wallet = yield* makeWalletApplication;
      const sessionKey = yield* makeSessionKeyApplication;

      return Application.of({
        billing,
        magicLink: { ...magicLinkRequest, ...magicLinkVerify },
        notification,
        organization: { ...organization, invitation, member },
        session,
        sessionKey,
        user,
        wallet,
      });
    }),
  ).pipe(Layer.provide(Audit.layer));
}
