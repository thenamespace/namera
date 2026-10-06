# @namera-ai/admin-portal

Internal operator console for beta invites, user accounts, and the waitlist.

It is a static Vite React SPA with no backend of its own. Every read and write
goes to `apps/server`'s `/internal` API, typed through `@namera-ai/api`, so the
portal holds no database credentials and cannot reach the database directly.

## Running it

```sh
cp .env.example .env
pnpm --filter @namera-ai/admin-portal dev
```

`VITE_API_URL` points at namera-core and defaults to `https://api.namera.ai` when
unset or blank, in both the browser client and build-time security policy.
Set it to `http://localhost:8080` for local API development. Its origin is the only host the page
may connect to: the Content-Security-Policy is generated from it at build time.

For the API side, set `ADMIN_TOKEN` (at least 32 characters) on the server, and
`ADMIN_CORS_ORIGIN` to this app's origin so the browser is allowed to send the
`Authorization` header on `/internal` requests.

## Signing in

There is no account system. An operator pastes the platform `ADMIN_TOKEN`, which
is sent as a bearer token on every request.

The token is held in `sessionStorage`, so it dies with the tab and is never
written to disk. It is the platform master credential: treat a browser with this
console open as a machine holding that credential. A rejected token is cleared
immediately, so a bad paste does not linger.

Revoking access means rotating `ADMIN_TOKEN` on the server, which invalidates it
for every consumer including curl and CI. There is no per-operator revocation.

## What it does not show

Invite codes exist in plaintext exactly once, in the response to a create
request. Only a hash is stored, so a code that is not copied from the creation
screen cannot be recovered. Codes are never logged and never appear in a list.

User records are projected into a dedicated DTO rather than returned whole: the
list selects named columns and flattens `metadata.name`, so nothing else in the
user record reaches the browser.

## Deployment

`Dockerfile` builds the static bundle and serves it from nginx on port 8080,
with the same generated security headers the bundle emits as `_headers`. The
`Deploy - Admin portal` workflow builds and pushes it.

The site is marked `noindex, nofollow` in both the document and the response
headers. Restrict `/internal` at the ingress as well: the token is the only
thing standing between the public internet and every user's email address.
