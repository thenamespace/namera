import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { MagicLinkError } from "@namera-ai/protocol";
import {
  RequestMagicLinkRequest,
  RequestMagicLinkResponse,
  VerifyMagicLinkRequest,
  VerifyMagicLinkResponse,
} from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";

export class MagicLinkGroup extends HttpApiGroup.make("magicLink")
  .add(
    HttpApiEndpoint.post("request", "/request", {
      payload: RequestMagicLinkRequest,
      error: [MagicLinkError, ...CommonErrors],
      success: RequestMagicLinkResponse,
    }).annotate(OpenApi.Summary, "Request a magic-link sign-in email"),
    HttpApiEndpoint.post("verify", "/verify", {
      payload: VerifyMagicLinkRequest,
      error: [MagicLinkError, ...CommonErrors],
      success: VerifyMagicLinkResponse,
    }).annotate(OpenApi.Summary, "Verify a magic link or email code"),
  )
  .annotate(OpenApi.Description, "Passwordless authentication")
  .prefix("/auth/magic-link") {}
