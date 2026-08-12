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

export interface ApplicationService {
  readonly magicLink: RequestMagicLinkApplication & VerifyMagicLinkApplication;
  readonly organization: OrganizationApplication & {
    readonly invitation: InvitationApplication;
    readonly member: MemberApplication;
  };
  readonly session: SessionApplication;
  readonly user: UserApplication;
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

      return Application.of({
        magicLink: { ...magicLinkRequest, ...magicLinkVerify },
        organization: { ...organization, invitation, member },
        session,
        user,
      });
    }),
  ).pipe(Layer.provide(Audit.layer));
}
