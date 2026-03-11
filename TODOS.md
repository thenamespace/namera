## Development (current)

### Dashboard

- [x] Basic Project Scaffolding
- [x] Magic Link Sign In
- [ ] Create Smart Accounts Page
  - [ ] EOA Owner Account
  - [ ] Passkey Owner Account
- [ ] Permission Templates Page
  - [ ] Create Permission Template to issue Session Keys
- [ ] Session Key Page
- [ ] Wallet Activity Page
- [ ] Wallet Assets Page
- [ ] Identity Page (Manage/Mint ENS Identity for Agents)
- [ ] Security Page (revoke all session keys, change owner etc.)
- [ ] MCP Pages
  - [ ] Manage MCP Connections
  - [ ] MCP Authorization Page
- [ ] Home Page

### Docs

- [x] Basic Project Scaffolding
- [x] Support for Markdown
- [x] Support for Code Snippets
- [x] Support for Math Expressions
- [x] Support for Typescript Twoslash
- [x] Last Modified Date (at bottom of page)
- [x] Mermaid Diagrams
- [x] Workspaces like structure for docs
- [ ] Dynamic OG Image Generation
- [ ] Home Page
- [ ] Writing Docs
  - [ ] Framework Docs
  - [ ] CLI Docs
  - [ ] MCP Docs
  - [ ] Core Docs
  - [ ] x402 Docs

### MCP Server

- [x] Base MCP Server Setup
- [ ] MCP Authorization using OAuth 2.1
- [ ] Tools
  - [ ] get_address
  - [ ] get_balance
  - [ ] send_transaction
  - [ ] sign_message
  - [ ] sign_typed_data ... and more

### CLI

- [ ] Basic Project Scaffolding
- [ ] Command Groups
  - [ ] Account Creation
  - [ ] Session Creation/Management
  - [ ] Local MCP Spawning

### Server

- [x] Effect HTTP Server Scaffolding
- [ ] Middlewares
  - [x] CORS
  - [x] Authentication
  - [ ] Rate Limiting
  - [x] API Reference/OpenAPI Documentation
- [ ] Routes
  - [x] Health Check
  - [x] Auth Routes
    - [x] Sign In Magic Link
    - [x] Verify Magic Link
    - [x] Current User
    - [x] Logout
    - [x] Revoke All Sessions
  - [ ] Account Routes
    - [ ] Create Account
    - [ ] Get Account
    - [ ] List All Accounts
  - [ ] Session Key Routes
    - [ ] Create Session Key
    - [ ] Get Session Key
    - [ ] List All Session Keys
    - [ ] Revoke Session Key
  - [ ] Permission Template Routes
    - [ ] Create Permission Template
    - [ ] Get Permission Template
    - [ ] List All Permission Templates
    - [ ] Update Permission Template
    - [ ] Delete Permission Template
  - [ ] MCP Routes
    - [ ] OAuth 2.1 Scope Routes