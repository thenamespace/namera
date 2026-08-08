# @namera-ai/api

Public-facing HTTP API definition for Namera, built with Effect `HttpApi`. This
package defines endpoint contracts, groups, middleware requirements, and OpenAPI
metadata. It does not start a server or implement backend workflows.

## Structure

- `src/index.ts` — complete `NameraAPI` definition and OpenAPI metadata.
- `src/routes/health.ts` — health endpoint group.
- `src/routes/auth/` — authentication and organization endpoint groups.
- `src/middlewares/` — middleware contracts such as authorization context.
- `src/common.ts` — errors shared by API groups.

## Usage

```ts
import { NameraApi } from "@namera-ai/api";
```

The future `apps/server` package supplies handlers, middleware implementations,
application services, runtime layers, and the HTTP server.

When adding an endpoint:

1. Define its request, response, and public error schemas in
   `@namera-ai/protocol`.
2. Add the endpoint to the appropriate `HttpApiGroup` here.
3. Implement the handler in the server using an application service.

Keep route definitions declarative. Do not query repositories, read environment
variables, or implement business logic in this package.
