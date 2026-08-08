import { NodeRuntime } from "@effect/platform-node";

import { runDatabaseMigrations } from "./layer.js";

NodeRuntime.runMain(runDatabaseMigrations());
