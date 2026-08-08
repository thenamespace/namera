import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

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
    }),
    HttpApiEndpoint.post("verify", "/verify", {
      payload: VerifyMagicLinkRequest,
      error: [MagicLinkError, ...CommonErrors],
      success: VerifyMagicLinkResponse,
    }),
  )
  .prefix("/auth/magic-link") {}
