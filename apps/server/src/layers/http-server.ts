import { createServer } from "node:http";

/** Bound incomplete HTTP requests independently of application/provider timeouts. */
export const createHttpServer = () =>
  createServer({
    headersTimeout: 10_000,
    requestTimeout: 30_000,
    keepAliveTimeout: 5_000,
    maxHeaderSize: 16 * 1024,
  });
