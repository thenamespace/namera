import { createConnection } from "node:net";

import { Deferred, Effect, Fiber, Layer, ManagedRuntime, Schema } from "effect";
import { TestClock } from "effect/testing";

import { Database, TestDatabase } from "@namera-ai/database";
import { afterEach, describe, expect, it, vi } from "vitest";

import { startServerProcess } from "../../fixtures/server-process.js";

const postgresPort = process.env.NAMERA_TEST_POSTGRES_PORT;
const children: Array<Awaited<ReturnType<typeof startServerProcess>>> = [];
afterEach(async () => {
  await Promise.all(children.splice(0).map((child) => child.stop()));
});

describe.skipIf(postgresPort === undefined)("deployed server composition", () => {
  it("keeps the TCP listener and workers closed while migrations wait for their lock", async () => {
    const runtime = ManagedRuntime.make(
      TestDatabase.postgresLayer(Number(postgresPort)).pipe(Layer.provide(TestClock.layer())),
    );
    const release = await runtime.runPromise(Deferred.make<void>());
    try {
      await runtime.runPromise(Effect.flatMap(TestDatabase, (database) => database.reset));
      const acquired = await runtime.runPromise(Deferred.make<void>());
      const lock = runtime.runFork(
        Effect.flatMap(Database, (database) =>
          database.transaction((tx) =>
            tx
              .execute("select pg_advisory_xact_lock(hashtext('namera_database_migrations'))")
              .pipe(
                Effect.andThen(Deferred.succeed(acquired, undefined)),
                Effect.andThen(Deferred.await(release)),
              ),
          ),
        ),
      );
      await runtime.runPromise(Effect.raceFirst(Deferred.await(acquired), Fiber.join(lock)));
      const server = await startServerProcess(Number(postgresPort));
      children.push(server);
      await vi.waitFor(
        async () => {
          expect(server.child.exitCode, server.output()).toBeNull();
          const waiting = await runtime.runPromise(
            Effect.flatMap(Database, (database) =>
              database.execute<{ waiting: number }>(
                "select count(*)::int as waiting from pg_stat_activity where datname = 'namera_test' and wait_event = 'advisory' and query like '%pg_advisory_lock%'",
              ),
            ),
          );
          const result = Schema.decodeUnknownSync(
            Schema.Struct({
              rows: Schema.Array(Schema.Struct({ waiting: Schema.Number })),
            }),
          )(waiting);
          expect(result.rows[0]?.waiting).toBeGreaterThan(0);
        },
        { timeout: 30_000, interval: 100 },
      );

      await expect(
        new Promise<void>((resolve, reject) => {
          const socket = createConnection({
            host: "127.0.0.1",
            port: Number(new URL(server.origin).port),
          });
          socket.once("connect", () => {
            socket.destroy();
            resolve();
          });
          socket.once("error", (error) => {
            socket.destroy();
            reject(error);
          });
          socket.setTimeout(1000, () => {
            socket.destroy();
            reject(new Error("TCP probe timed out"));
          });
        }),
      ).rejects.toMatchObject({ code: "ECONNREFUSED" });
      await server.stop();
      children.splice(children.indexOf(server), 1);
      expect(server.output()).not.toContain("database.migrations_completed");
      expect(server.output()).not.toContain("Listening on");
      expect(server.output()).not.toContain("worker.stopped");
      expect(server.output()).not.toContain("worker.failed");
    } finally {
      await runtime.runPromise(Deferred.succeed(release, undefined));
      await runtime.dispose();
    }
  }, 60_000);

  it("mounts the production routes and middleware and shuts down every worker with its listener", async () => {
    const runtime = ManagedRuntime.make(
      TestDatabase.postgresLayer(Number(postgresPort)).pipe(Layer.provide(TestClock.layer())),
    );
    try {
      await runtime.runPromise(Effect.flatMap(TestDatabase, (database) => database.reset));
    } finally {
      await runtime.dispose();
    }
    const server = await startServerProcess(Number(postgresPort));
    children.push(server);
    await vi.waitFor(
      async () => {
        expect(server.child.exitCode, server.output()).toBeNull();
        const response = await fetch(server.origin, { signal: AbortSignal.timeout(1000) });
        expect(await response.text()).toBe("Namera API");
      },
      { timeout: 30_000, interval: 100 },
    );
    expect(server.output()).toContain("database.migrations_completed");
    expect(server.output()).toContain(`Listening on ${server.origin}`);
    expect(server.output().indexOf("database.migrations_completed")).toBeLessThan(
      server.output().indexOf("Listening on"),
    );

    const request = async (path: string, options?: RequestInit) => {
      const response = await fetch(`${server.origin}${path}`, {
        ...options,
        signal: AbortSignal.timeout(5000),
      });
      expect(response.headers.get("x-frame-options"), `${path}: ${response.status}`).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      return response;
    };
    const health = await request("/health");
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ status: true });
    const discovery = await request("/.well-known/oauth-authorization-server");
    expect(discovery.status).toBe(200);
    expect(discovery.headers.get("cache-control")).toBe("public, max-age=300");
    expect(await discovery.json()).toMatchObject({ issuer: server.origin });
    const missing = await request("/missing-smoke-route");
    expect(missing.status).toBe(404);
    expect(missing.headers.get("cache-control")).toBe("no-store");
    await missing.text();
    const reference = await request("/reference");
    expect(reference.status).toBe(200);
    expect(await reference.text()).toContain("scalar");
    const spec = await request("/openapi.json");
    expect(spec.status).toBe(200);
    const openapi = Schema.decodeUnknownSync(
      Schema.Struct({
        paths: Schema.Record(Schema.String, Schema.Unknown),
      }),
    )(await spec.json());
    expect(Object.keys(openapi.paths).some((path) => path.startsWith("/internal"))).toBe(false);
    const protectedResponse = await request("/auth/session/me");
    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.headers.get("cache-control")).toBe("no-store");
    await protectedResponse.text();
    const internal = await request("/internal/overview");
    expect(internal.status).toBe(401);
    await internal.text();
    const preflight = await request("/auth/session/me", {
      method: "OPTIONS",
      headers: { origin: "http://dashboard.test", "access-control-request-method": "GET" },
    });
    expect(preflight.headers.get("access-control-allow-origin")).toBe("http://dashboard.test");
    await preflight.text();
    const oauth = await request("/oauth/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: "grant_type=unsupported",
    });
    expect(oauth.status).toBe(400);
    expect(await oauth.json()).toMatchObject({ error: "unsupported_grant_type" });
    const oversized = await request("/oauth/token", { method: "POST", body: "x".repeat(65_537) });
    expect(oversized.status).toBe(413);
    await oversized.text();
    const rpc = await request("/rpc/eip155/not-a-chain", { method: "POST", body: "{}" });
    expect(rpc.status).toBe(400);
    expect(await rpc.json()).toMatchObject({ _tag: "UnsupportedChainError" });

    await server.stop();
    children.splice(children.indexOf(server), 1);
    for (const worker of ["wallet_operation", "execution", "session_key", "billing", "email"]) {
      expect(server.output()).toContain(`${worker}.worker.stopped`);
    }
    expect(server.output()).not.toContain("worker.failed");
    await expect(fetch(server.origin, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
  }, 60_000);

  it("never opens the listener or starts workers when migration connection fails", async () => {
    const server = await startServerProcess(Number(postgresPort), "namera_missing_smoke_database");
    children.push(server);
    await vi.waitFor(() => expect(server.child.exitCode, server.output()).not.toBeNull(), {
      timeout: 30_000,
      interval: 100,
    });
    expect(server.child.exitCode).not.toBe(0);
    expect(server.output()).toContain("Database migration failed");
    expect(server.output()).not.toContain("database.migrations_completed");
    expect(server.output()).not.toContain("Listening on");
    expect(server.output()).not.toContain("worker.stopped");
    expect(server.output()).not.toContain("worker.failed");
    await expect(fetch(server.origin, { signal: AbortSignal.timeout(1000) })).rejects.toThrow();
  }, 45_000);
});
