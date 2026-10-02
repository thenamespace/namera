import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

export const run = (command, args, cwd, env = process.env) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed (${signal ?? code})`));
    });
  });

// Serve candidate packages without publishing them. Other dependencies come from npm.
export const startPackageRegistry = async (packages) => {
  const shrinkwrapped = new Set(
    packages
      .filter(({ tarball }) =>
        execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
          .split("\n")
          .includes("package/npm-shrinkwrap.json"),
      )
      .map(({ manifest }) => manifest.name),
  );
  const tarballs = new Map(
    packages.map(({ manifest, tarball }) => [manifest.name, readFileSync(tarball)]),
  );
  const server = createServer(async (request, response) => {
    try {
      if (request.method !== "GET") {
        response.writeHead(405).end();
        return;
      }
      const path = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const candidate = packages.find(
        ({ manifest }) =>
          path === `/${manifest.name}` ||
          path === `/${manifest.name}/${manifest.version}` ||
          path === `/${manifest.name}/-/candidate.tgz`,
      );
      if (candidate) {
        const { manifest } = candidate;
        const bytes = tarballs.get(manifest.name);
        if (path.endsWith("/candidate.tgz")) {
          response.writeHead(200, { "content-type": "application/octet-stream" }).end(bytes);
          return;
        }
        const version = {
          ...manifest,
          // npm uses registry metadata to decide whether to load the bundled lock.
          ...(shrinkwrapped.has(manifest.name) ? { _hasShrinkwrap: true } : {}),
          dist: {
            tarball: `${origin}/${manifest.name}/-/candidate.tgz`,
            integrity: `sha512-${createHash("sha512").update(bytes).digest("base64")}`,
          },
        };
        response.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify(
            path === `/${manifest.name}/${manifest.version}`
              ? version
              : {
                  name: manifest.name,
                  "dist-tags": { latest: manifest.version },
                  versions: { [manifest.version]: version },
                },
          ),
        );
        return;
      }
      // Never silently test an already-published Namera package instead of a candidate.
      if (path.startsWith("/@namera-ai/")) {
        response.writeHead(404).end();
        return;
      }
      const upstream = await fetch(`https://registry.npmjs.org${request.url}`, {
        signal: AbortSignal.timeout(30_000),
      });
      response
        .writeHead(upstream.status, {
          "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        })
        .end(Buffer.from(await upstream.arrayBuffer()));
    } catch (error) {
      process.stderr.write(`Candidate registry request failed: ${error.message}\n`);
      response.writeHead(502).end();
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};
