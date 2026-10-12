import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const envPath = process.argv[2] ?? "apps/server/.env";

try {
  const env = parseEnv(readFileSync(envPath, "utf8"));
  const value = env.ONECLAW_OIDC_PRIVATE_KEY;
  if (!value?.trim()) {
    throw new Error("missing-key");
  }

  const pem = value.replaceAll("\\n", "\n");
  process.stdout.write(`${Buffer.from(pem, "utf8").toString("base64")}\n`);
} catch {
  process.stderr.write(
    "Could not convert the key. Check that the env file is readable and contains ONECLAW_OIDC_PRIVATE_KEY.\n",
  );
  process.exitCode = 1;
}
