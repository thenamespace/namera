### --profile

- **Type:** `string`
- **Default:** `default`

Choose the MCP connection name. This is separate from ordinary CLI profiles,
whose default is `personal`. Use the same name for `serve`, `login`, `status`,
and `logout`.

### --host

- **Type:** absolute API URL
- **Default:** `https://api.namera.ai`

Choose the API origin for this MCP connection. The origin and profile together
identify its saved credentials. Use HTTPS, or a loopback HTTP origin for local
development. `NAMERA_API_URL` does not override this option on MCP commands.
