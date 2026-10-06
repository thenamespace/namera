import type { Plugin } from "vite";

export const documentSecurity = (apiUrl: string) => {
  const api = new URL(apiUrl);
  if (!["https:", "http:"].includes(api.protocol) || api.username || api.password) {
    throw new Error("VITE_API_URL must be an HTTP(S) URL without credentials");
  }

  const contentPolicy = [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "script-src 'self'",
    // UIKit positioning, charts and Motion set inline styles, not inline scripts.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "manifest-src 'self'",
    "img-src 'self' https: data: blob:",
    `connect-src 'self' ${api.origin}`,
    "form-action 'self'",
  ].join("; ");
  const headers = {
    "Content-Security-Policy": `${contentPolicy}; frame-ancestors 'none'`,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), publickey-credentials-create=(self), publickey-credentials-get=(self)",
  };

  const plugin: Plugin = {
    name: "namera-document-security",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler: () => [
        {
          tag: "meta",
          attrs: { "http-equiv": "Content-Security-Policy", content: contentPolicy },
          injectTo: "head-prepend",
        },
        {
          tag: "meta",
          attrs: { name: "referrer", content: "no-referrer" },
          injectTo: "head-prepend",
        },
      ],
    },
    generateBundle() {
      // Static hosts must apply these headers; meta CSP cannot forbid embedding.
      this.emitFile({
        type: "asset",
        fileName: "_headers",
        source: `/*\n${Object.entries(headers)
          .map(([name, value]) => `  ${name}: ${value}`)
          .join("\n")}\n`,
      });
    },
  };

  return { headers, plugin };
};
