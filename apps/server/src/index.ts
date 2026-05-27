import { config } from "dotenv";
config();

import { createServer } from "node:http";

import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
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
  UserPreferencesGroupLive,
  AuthCoreGroupLive,
  MagicLinkGroupLive,
  HealthGroupLive,
  OrganizationGroupLive,
  RpcGroupLive,
  UserGroupLive,
} from "./routes";

const NameraApiLive = Layer.mergeAll(
  UserPreferencesGroupLive,
  HealthGroupLive,
  RpcGroupLive,
  AuthCoreGroupLive,
  UserGroupLive,
  MagicLinkGroupLive,
  OrganizationGroupLive,
);

const app = HttpApiBuilder.layer(api).pipe(
  Layer.provide(NameraApiLive),
  Layer.provide(Middlewares),
  HttpRouter.serve,
  Layer.provide(NodeHttpServer.layer(createServer, { port: 8080 })),
  Layer.provide(Database.layer),
  Layer.provide(AdminDatabase.layer),
  Layer.provide(Auth.layer),
  Layer.provide(Domain.layer),
  Layer.provide(OtelNode.layer("namera-backend")),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(Env.layer),
);

NodeRuntime.runMain(Layer.launch(app));
