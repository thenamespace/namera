import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi";

import { MagicLinkErrors } from "@namera-ai/protocol";
import {
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  VerifyMagicLinkRequest,
  VerifyMagicLinkResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";

const NoStoreHeaders = {
  "cache-control": Schema.Literal("no-store"),
};

export class MagicLinkGroup extends HttpApiGroup.make("magicLink")
  .add(
    HttpApiEndpoint.post("request", "/request", {
      payload: RequestMagicLinkRequest,
      error: [...MagicLinkErrors, ...CommonErrors],
      success: HttpApiSchema.WithHeaders(
        RequestMagicLinkResponse.pipe(HttpApiSchema.status("Accepted")),
        NoStoreHeaders,
      ),
    }).annotate(OpenApi.Summary, "Request a magic-link sign-in email"),
    HttpApiEndpoint.post("verify", "/verify", {
      payload: VerifyMagicLinkRequest,
      error: [...MagicLinkErrors, ...CommonErrors],
      success: HttpApiSchema.WithHeaders(VerifyMagicLinkResponse, NoStoreHeaders),
    }).annotate(OpenApi.Summary, "Verify a magic link or email code"),
  )
  .annotate(OpenApi.Description, "Passwordless authentication")
  .prefix("/auth/magic-link") {}
