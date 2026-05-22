import { config } from "dotenv";
config();

import { BunHttpServer, BunRuntime } from "@effect/platform-bun";
import { Layer } from "effect";

import { FetchHttpClient, HttpRouter } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { api } from "@namera-ai/api";
import { Auth } from "@namera-ai/auth";
import { AdminDatabase, Database } from "@namera-ai/database";
import { Domain } from "@namera-ai/domain";
import { OtelNode } from "@namera-ai/telemetry";

import * as Env from "./env";
import { Middlewares } from "./middlewares";
import {
  AuthCoreGroupLive,
  MagicLinkGroupLive,
  HealthGroupLive,
  OrganizationGroupLive,
  RpcGroupLive,
} from "./routes";

const NameraApiLive = Layer.mergeAll(
  HealthGroupLive,
  RpcGroupLive,
  AuthCoreGroupLive,
  MagicLinkGroupLive,
  OrganizationGroupLive,
);

const app = HttpApiBuilder.layer(api).pipe(
  Layer.provide(NameraApiLive),
  Layer.provide(Middlewares),
  HttpRouter.serve,
  Layer.provide(BunHttpServer.layer({ port: 8080 })),
  Layer.provide(Database.layer),
  Layer.provide(AdminDatabase.layer),
  Layer.provide(Auth.layer),
  Layer.provide(Domain.layer),
  Layer.provide(OtelNode.layer),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(Env.layer),
);

BunRuntime.runMain(Layer.launch(app));
