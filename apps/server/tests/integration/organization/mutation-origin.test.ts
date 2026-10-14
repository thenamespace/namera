import { expect, layer } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import { HttpEffect, HttpRouter, HttpServerRequest, type HttpServerResponse } from "effect/http";
import { HttpApiBuilder } from "effect/http-api";

import { NameraApi } from "@namera-ai/api";
import { Repository } from "@namera-ai/database";

import { CorsMiddleware } from "#/middlewares/cors";

import {
  createMember,
  findOrganizationRole,
  inviteMember,
  makeTestApiClient,
  resetTestState,
  setAuthToken,
  signIn,
  testEmail,
} from "../../fixtures/index.js";
import { makeTestConfigLayer } from "../../fixtures/layers/config.js";
import { TestServerLayer } from "../../fixtures/layers/index.js";

const send = Effect.fnUntraced(function* (request: Request) {
  const handler = yield* HttpRouter.toHttpEffect(
    Layer.merge(
      HttpApiBuilder.layer(NameraApi),
      CorsMiddleware.pipe(
        Layer.provide(makeTestConfigLayer({ SERVER_CORS_ORIGIN: "http://dashboard.test" })),
      ),
    ),
  );
  let response: HttpServerResponse.HttpServerResponse | undefined;
  yield* HttpEffect.toHandled(handler, (_request, result) =>
    Effect.sync(() => {
      response = result;
    }),
  ).pipe(
    Effect.provideService(HttpServerRequest.HttpServerRequest, HttpServerRequest.fromWeb(request)),
  );
  if (!response) return yield* Effect.die("Missing response");
  return response;
});

layer(TestServerLayer)("organization mutation origins", (it) => {
  for (const origin of [
    undefined,
    "null",
    "http://untrusted.api.test",
    "http://dashboard.test",
  ] as const) {
    for (const action of [
      "create-organization",
      "set-active-organization",
      "update-organization",
      "update-member-role",
      "remove-member",
      "invite-member",
      "accept-invitation",
      "reject-invitation",
      "cancel-invitation",
    ] as const) {
      it.effect(`${action}: Origin ${origin}`, () =>
        Effect.gen(function* () {
          yield* resetTestState();
          const api = yield* makeTestApiClient;
          const owner = yield* signIn(
            api,
            testEmail(`origin-owner-${crypto.randomUUID()}@example.com`),
          );
          const admin = yield* createMember(
            api,
            testEmail(`origin-admin-${crypto.randomUUID()}@example.com`),
            "admin",
          );
          yield* setAuthToken(owner.cookie.value);
          const memberRole = yield* findOrganizationRole(owner.actor.organization.id, "member");
          const recipientEmail = testEmail(`origin-recipient-${crypto.randomUUID()}@example.com`);
          const invitation = yield* inviteMember(api, recipientEmail, owner.actor.organization.id);
          const recipient = yield* signIn(api, recipientEmail);
          const payloads = {
            "create-organization": { metadata: { version: 1, name: "New organization" } },
            "set-active-organization": { organizationId: owner.actor.organization.id },
            "update-organization": { metadata: { version: 1, name: "Changed organization" } },
            "update-member-role": {
              organizationMemberId: admin.actor.member.organizationMember.id,
              organizationRoleId: memberRole.id,
            },
            "remove-member": { organizationMemberId: admin.actor.member.organizationMember.id },
            "invite-member": {
              email: testEmail(`new-${crypto.randomUUID()}@example.com`),
              organizationRoleId: memberRole.id,
            },
            "accept-invitation": { invitationId: invitation.invitation.id },
            "reject-invitation": { invitationId: invitation.invitation.id },
            "cancel-invitation": { invitationId: invitation.invitation.id },
          };
          const repository = yield* Repository;
          const snapshot = Effect.gen(function* () {
            return {
              organizations: yield* repository.auth.member.findMembershipsForUser(
                owner.actor.user.id,
              ),
              members: yield* repository.auth.member.findOrganizationMembersForOrg(
                owner.actor.organization.id,
              ),
              invitations: yield* repository.auth.invitation.findPendingForOrgId(
                owner.actor.organization.id,
                yield* DateTime.now,
              ),
              audit: yield* repository.audit.organization.findForOrganization(
                owner.actor.organization.id,
              ),
            };
          });
          const before = yield* snapshot;
          const group = action.endsWith("organization")
            ? "organization"
            : action === "update-member-role" || action === "remove-member"
              ? "member"
              : "invitation";
          const cookie =
            action === "accept-invitation" || action === "reject-invitation"
              ? recipient.cookie.value
              : owner.cookie.value;
          const request = new Request(`http://api.test/auth/${group}/${action}`, {
            method: "POST",
            headers: {
              cookie: `auth-token=${cookie}`,
              "sec-fetch-site": "same-site",
              ...(origin === undefined ? {} : { origin }),
            },
            body: new TextEncoder().encode(JSON.stringify(payloads[action])),
          });
          expect(request.headers.has("content-type")).toBe(false);
          const response = yield* send(request);
          if (origin === "http://dashboard.test") {
            expect(response.status).toBeGreaterThanOrEqual(200);
            expect(response.status).toBeLessThan(300);
          } else {
            expect(response.status).toBe(403);
            expect(yield* snapshot).toEqual(before);
          }
        }),
      );
    }
  }
});
