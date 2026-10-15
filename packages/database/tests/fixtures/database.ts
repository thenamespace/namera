import { TestDatabase } from "../../src/index.js";

const port = process.env.NAMERA_TEST_POSTGRES_PORT;

// postgresLayer validates the separate port and pins the disposable loopback database.
export const DatabaseTestLayer =
  port === undefined ? TestDatabase.layer : TestDatabase.postgresLayer(Number(port));
