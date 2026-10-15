import { spawn } from "node:child_process";
import { generateKeyPairSync } from "node:crypto";
import { once } from "node:events";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const serverDirectory = fileURLToPath(new URL("../../", import.meta.url));

export const startServerProcess = async (postgresPort: number, database = "namera_test") => {
  if (!Number.isInteger(postgresPort) || postgresPort <= 0 || postgresPort === 5432) {
    throw new Error("Server smoke requires a disposable non-default PostgreSQL port");
  }

  const listener = createServer((_request, response) => response.end());
  listener.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const address = listener.address();
  if (!address || typeof address === "string") throw new Error("Missing fixture listener");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    listener.close((error) => (error ? reject(error) : resolve())),
  );

  const telemetry = createServer((request, response) => {
    request.resume();
    response.end();
  });
  telemetry.listen(0, "127.0.0.1");
  await once(telemetry, "listening");
  const telemetryAddress = telemetry.address();
  if (!telemetryAddress || typeof telemetryAddress === "string") {
    throw new Error("Missing telemetry fixture listener");
  }

  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const origin = `http://127.0.0.1:${port}`;
  const child = spawn(
    process.execPath,
    ["--import", "tsx", "--conditions=namera-source", "src/index.ts"],
    {
      cwd: serverDirectory,
      stdio: ["ignore", "pipe", "pipe"],
      // Do not inherit developer credentials or production endpoints into the child.
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "development",
        SERVER_HOST: "127.0.0.1",
        SERVER_PORT: String(port),
        SERVER_CORS_ORIGIN: "http://dashboard.test",
        ADMIN_CORS_ORIGIN: "http://admin.test",
        AUTH_API_PUBLIC_ORIGIN: origin,
        AUTH_DASHBOARD_PUBLIC_ORIGIN: "http://dashboard.test",
        AUTH_INVITE_REQUIRED: "false",
        POSTGRES_HOST: "127.0.0.1",
        POSTGRES_PORT: String(postgresPort),
        POSTGRES_DATABASE: database,
        POSTGRES_USERNAME: "postgres",
        POSTGRES_PASSWORD: "test",
        CRYPTO_HMAC_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        CRYPTO_ENCRYPTION_KEY: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        ONECLAW_PLATFORM_APP_ID: "smoke-app",
        ONECLAW_PLATFORM_API_KEY: "smoke-key",
        ONECLAW_EMPTY_TEMPLATE_ID: "smoke-template",
        ONECLAW_EMPTY_TEMPLATE_VERSION: "1",
        ONECLAW_ORG_EMAIL_DOMAIN: "example.invalid",
        ONECLAW_OIDC_ISSUER: `${origin}/providers/1claw`,
        ONECLAW_OIDC_AUDIENCE: "smoke-audience",
        ONECLAW_OIDC_KEY_ID: "smoke-key",
        ONECLAW_OIDC_PRIVATE_KEY_BASE64: Buffer.from(
          privateKey.export({ type: "pkcs8", format: "pem" }),
        ).toString("base64"),
        EVM_ALCHEMY_API_KEY: "smoke-key",
        EVM_ALCHEMY_BSO_POLICY_ID: "smoke-policy",
        NAMERA_ENS_API_KEY: "smoke-key",
        OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${telemetryAddress.port}`,
      },
    },
  );
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString();
  });
  const exited = once(child, "exit");

  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
      const timeout = setTimeout(() => child.kill("SIGKILL"), 10_000);
      try {
        await exited;
      } finally {
        clearTimeout(timeout);
      }
    } finally {
      telemetry.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        telemetry.close((error) => (error ? reject(error) : resolve())),
      );
    }
  };

  return { origin, child, exited, stop, output: () => output };
};
