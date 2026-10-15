# Contracts and publication

`packages/protocol` owns runtime schemas and derived types.
`packages/api` composes those schemas into `NameraApi`, the Effect HTTP contract.
Server handlers, dashboard clients, and the SDK consume that contract rather
than maintaining independent HTTP shapes.

## Schema boundaries

| Export           | Responsibility                                                            |
| ---------------- | ------------------------------------------------------------------------- |
| Protocol root    | Shared primitives, branded identifiers, policies, expected errors         |
| `protocol/dto`   | Public request and response projections                                   |
| `protocol/model` | Domain and persistence models, including sensitive fields                 |
| `protocol/evm`   | EVM calls, chain identifiers, permissions, execution and signature shapes |
| `protocol/local` | Client-only authority bindings and encrypted key exports                  |

Namespaces and operation variants use discriminated schemas. Encoded and decoded
values can differ: integer-string codecs preserve large amounts, and timestamps
decode into the declared runtime representation. Transport encoders own this
conversion. Model fields are not automatically safe public response fields.

API groups specify methods, paths, query/payload schemas, success status, expected
errors, middleware, and OpenAPI annotations. They contain no repositories or
business workflows. Authorization declarations identify the boundary; server
middleware and application checks enforce the actual actor and authority.

Internal operator routes carry `AdminAuthorization` and `OpenApi.Exclude`.
They remain available to the typed internal client but absent from public OpenAPI.
OAuth form endpoints retain their protocol-specific encodings and headers.

Account passkey-registration options accept a JSON request for API-key application
origins and user labels; empty legacy browser requests remain accepted. Session
responses preserve human creator fields and add an explicit API-key creator
variant. New management permissions are API-key-specific and never inherited by
OAuth actors or existing credentials.

## Client boundary

The SDK derives ergonomic request types from DTOs: identifiers are strings,
amounts are bigints, and namespace/chain literals remain constrained. It decodes
inputs before transport and signing. Declared API errors retain their tagged
cause inside the SDK result.

A valid schema does not establish authorization, installed permissions, signature
validity, or namespace support. Those checks belong to the executing workflow.

## Publication

API, protocol, SDK, and CLI form one fixed Changesets release group. Their package
exports select source under `namera-source` in the workspace and built artifacts
for consumers. SDK exports also distinguish Node and browser entry points.

`script/cli-shrinkwrap.mjs` maintains the CLI's tested runtime dependency graph.
`script/check-packages.mjs` validates candidate tarballs with clean external npm
installs through a temporary loopback registry. It exercises CLI startup, SDK
decoding, protocol schemas, and OpenAPI generation without production requests.

## Source map

- [Protocol exports](../../packages/protocol/src/index.ts)
- [DTO exports](../../packages/protocol/src/dto/index.ts)
- [HTTP contract](../../packages/api/src/index.ts)
- [SDK input types](../../packages/sdk/src/inputs.ts)
- [Release group](../../.changeset/config.json)
