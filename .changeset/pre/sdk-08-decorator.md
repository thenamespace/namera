---
"@namera-ai/sdk": minor
---

`@namera-ai/sdk/decorators`: `client.extend(nameraActions())` adds Namera's network functions under `client.namera`
(`grant` and `account`), each bound to the client and forwarding to the standalone function. Public clients get the
reads; bundler clients also get the owner operations (`grant.revoke`, `account.installSessions`, …), which are a type
error on a public client. The decorator's types infer only whether the client has bundler actions, so decorating a
client costs about 600 type instantiations.
