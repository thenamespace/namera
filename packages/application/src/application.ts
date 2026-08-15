import { Context, Effect, Layer } from "effect";

import { Audit } from "#/audit/layer";
import { makeApiKeyApplication, type ApiKeyApplication } from "#/auth/core/api-key";
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
import { makeOAuthApplication } from "#/auth/oauth/index";
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
import { makeExecutionApplication, type ExecutionApplication } from "#/execution/index";
import { makeNotificationApplication, type NotificationApplication } from "#/notification/index";
import { makeSessionKeyApplication, type SessionKeyApplication } from "#/session-key/index";
import { makeSignatureApplication, type SignatureApplication } from "#/signature/index";
import { makeWalletApplication, type WalletApplication } from "#/wallet/index";

export interface ApplicationService {
  readonly apiKey: ApiKeyApplication;
  readonly billing: BillingApplication;
  readonly magicLink: RequestMagicLinkApplication & VerifyMagicLinkApplication;
  readonly notification: NotificationApplication;
  readonly oauth: Effect.Success<typeof makeOAuthApplication>;
  readonly execution: ExecutionApplication;
  readonly organization: OrganizationApplication & {
    readonly invitation: InvitationApplication;
    readonly member: MemberApplication;
  };
  readonly session: SessionApplication;
  readonly sessionKey: SessionKeyApplication;
  readonly signature: SignatureApplication;
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
      const apiKey = yield* makeApiKeyApplication;
      const user = yield* makeUserApplication;
      const magicLinkRequest = yield* makeRequestMagicLinkApplication;
      const magicLinkVerify = yield* makeVerifyMagicLinkApplication;
      const organization = yield* makeOrganizationApplication;
      const invitation = yield* makeInvitationApplication;
      const member = yield* makeMemberApplication;
      const notification = yield* makeNotificationApplication;
      const oauth = yield* makeOAuthApplication;
      const billing = yield* makeBillingApplication;
      const wallet = yield* makeWalletApplication;
      const sessionKey = yield* makeSessionKeyApplication;
      const execution = yield* makeExecutionApplication;
      const signature = yield* makeSignatureApplication;

      return Application.of({
        apiKey,
        billing,
        magicLink: { ...magicLinkRequest, ...magicLinkVerify },
        notification,
        oauth,
        execution,
        organization: { ...organization, invitation, member },
        session,
        sessionKey,
        signature,
        user,
        wallet,
      });
    }),
  ).pipe(Layer.provide(Audit.layer));
}
