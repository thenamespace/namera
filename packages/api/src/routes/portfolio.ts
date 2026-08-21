import { HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi";

import { PortfolioUnavailableError } from "@namera-ai/protocol";
import { PortfolioResponse, QueryPortfolioRequest } from "@namera-ai/protocol/dto";

import { CommonErrors } from "#/common";
import { Authorization } from "#/middlewares/index";

export class PortfolioGroup extends HttpApiGroup.make("portfolio")
  .add(
    HttpApiEndpoint.post("query", "/assets/query", {
      payload: QueryPortfolioRequest,
      success: PortfolioResponse,
      error: [PortfolioUnavailableError, ...CommonErrors],
    }).annotate(OpenApi.Summary, "Query a paginated cross-chain fungible portfolio"),
  )
  .annotate(OpenApi.Description, "Namespace-neutral portfolio data")
  .middleware(Authorization)
  .prefix("/portfolios") {}
