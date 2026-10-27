# MCP

If Namera tools are connected, use their current schemas. SDK parameters and CLI
flags are not MCP tool inputs.

## Connect a client

Follow [Getting Started](https://namera.ai/docs/mcp/getting-started.md) and the
[user's client guide](https://namera.ai/docs/mcp/clients.md). Namera uses local
stdio through the CLI; there is no hosted MCP URL for URL-only clients.

Authorize the profile configured in the client using
[Authentication](https://namera.ai/docs/mcp/authentication.md). Ordinary CLI login
and API keys do not authorize MCP. Verify access with an account or session-key read.

## Access and gas

Read [Permissions and Limits](https://namera.ai/docs/mcp/permissions.md) for allowed
operations and self-funded gas. The user configures the gas ceiling on the server;
a tool cannot raise it. Account creation and session installation use the dashboard
or SDK, not MCP tools.

For connection failures, use [Troubleshooting](https://namera.ai/docs/mcp/troubleshooting.md).
For profile changes, use [Profiles and Configuration](https://namera.ai/docs/mcp/profiles-and-configuration.md).
To disconnect, follow the authentication guide's revocation instructions as well
as removing the client configuration.
