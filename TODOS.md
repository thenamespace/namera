## Development (current)

### Docs

- [x] Basic Project Scaffolding
- [x] Support for Markdown
- [x] Support for Code Snippets
- [x] Support for Math Expressions
- [x] Support for Typescript Twoslash
- [x] Last Modified Date (at bottom of page)
- [x] Mermaid Diagrams
- [x] Workspaces like structure for docs
- [x] Dynamic OG Image Generation
- [x] Home Page
  - [ ] Illustrations
- [ ] Writing Docs
  - [ ] Protocol Docs
  - [ ] CLI Docs
  - [ ] Core Docs

### CLI

- [x] Basic Project Scaffolding
- [x] Prompting Library
  - [x] Text Prompts
  - [x] Password Prompts
  - [x] Select Prompts
  - [x] Multi Select Prompts
  - [x] Confirm Prompts
  - [x] Date Prompts
  - [x] File Prompts
  - [x] Number Prompts
  - [x] Ethereum Address/Private Key/Hex Prompts
- [x] Command Groups
  - [x] Keystores
    - [x] Create Keystore
    - [x] List Keystores
    - [x] Decrypt Keystore
    - [x] Import Keystore
    - [x] Remove Keystore
    - [x] Get Keystore
  - [x] Smart Accounts
    - [x] Create Smart Account
    - [x] List Smart Accounts
    - [x] Get Smart Account
    - [x] Remove Smart Account
    - [x] Get Smart Account Deployment Status (per chain)
    - [x] Import Smart Account (assuming owner keystore is present)
  - [x] Session Keys
    - [x] Create Session Key
      - [x] Sudo Policy
      - [x] Timestamp Policy
      - [x] Gas Policy
      - [x] Call Policy
      - [x] Signature Policy
      - [x] Rate Limit Policy
    - [x] Get Session Key
    - [x] List Session Keys (All and per Smart Account)
    - [ ] Revoke Session Key
    - [ ] Import Session Key
    - [x] Remove Session Key
    - [x] Get Session Key Installation Status (per chain) (need to test)
  - [x] Schemas
    - [x] Get CLI Command Params Schema
  - [x] MCP Server
    - [x] 1 Account, N Session Keys Server
    - [x] Tools
      - [x] Account Tools
        - [x] `get_wallet_address`
        - [x] `get_balance`
      - [ ] Read Operations
        - [ ] `read_contract`
      - [ ] Transfer Tools
        - [x] `native_transfer`
      - [x] Transaction Tools
        - [x] `execute_transaction`
- [ ] Audit Code

