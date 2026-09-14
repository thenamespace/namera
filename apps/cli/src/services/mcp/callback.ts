import { spawn } from "node:child_process";
import { timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

export const openAuthorizationBrowser = (url: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const command =
      process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "rundll32"
          : "xdg-open";
    const args = process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
    const child = spawn(command, args, { stdio: "ignore", timeout: 10_000 });
    child.once("error", () => reject(new Error("Open the authorization URL in your browser.")));
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error("Open the authorization URL in your browser."));
    });
  });

export const listenForAuthorization = async (state: string, signal: AbortSignal) => {
  let accept!: (code: string) => void;
  let deny!: (error: Error) => void;
  let consumed = false;
  const code = new Promise<string>((resolve, reject) => {
    accept = resolve;
    deny = reject;
  });
  // A cancellation can happen before the caller starts awaiting the callback.
  void code.catch(() => undefined);
  let authority = "";
  const server = createServer(
    { headersTimeout: 10_000, requestTimeout: 10_000 },
    (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
      const url = URL.parse(request.url ?? "/", `http://${authority}`);
      if (!url) {
        response.writeHead(400).end("Invalid authorization callback.");
        return;
      }
      const received = url.searchParams.get("state") ?? "";
      const params = [...url.searchParams.keys()];
      const receivedBytes = Buffer.from(received);
      const expectedBytes = Buffer.from(state);
      const validState =
        receivedBytes.length === expectedBytes.length &&
        timingSafeEqual(receivedBytes, expectedBytes);
      if (
        request.method !== "GET" ||
        request.headers.host !== authority ||
        url.origin !== `http://${authority}` ||
        request.headers.origin !== undefined ||
        (request.url?.length ?? 0) > 8192 ||
        url.pathname !== "/oauth/callback" ||
        consumed ||
        params.length !== new Set(params).size ||
        !validState ||
        url.searchParams.has("code") === url.searchParams.has("error")
      ) {
        response.writeHead(400).end("Invalid authorization callback.");
        return;
      }
      consumed = true;
      const value = url.searchParams.get("code");
      if (!value || value.length > 2048) {
        deny(new Error("Authorization was denied. Run namera mcp login to try again."));
        response.writeHead(400).end("Authorization was not completed. Return to Namera.");
      } else {
        accept(value);
        response.end("Authorization received. You can close this tab and return to your agent.");
      }
    },
  );
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not open OAuth callback.");
  authority = `127.0.0.1:${address.port}`;
  const abort = () => {
    deny(new Error("Authorization cancelled."));
    server.closeAllConnections();
    server.close();
  };
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  return {
    callback: `http://${authority}/oauth/callback`,
    code,
    close: () => {
      signal.removeEventListener("abort", abort);
      server.closeAllConnections();
      server.close();
    },
  };
};
