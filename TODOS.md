## Namera Frontend

- [x] Auth
  - [x] Sign in with Magic Link
  - [ ] Sign in with Google
- [ ] Inbox Page (view important updates to organization and user)
- [ ] Overview Page
- [ ] Assets Page (view assets owned by all smart accounts combined, and per smart account)
- [x] Smart Account
  - [x] Smart Accounts Page (view created smart accounts)
  - [x] Create Smart Account Page (create smart account)
- [x] Session Keys
  - [x] View Session Keys Page (view session keys)
  - [ ] Create Session Key Page (create session key)
  - [ ] Individual Session Key Page (view individual session key details, revoke session key, etc)
- [ ] Templates
  - [ ] Browse Templates Page (view curated templates)
  - [ ] Individual Template Page (view individual template details)
  - [ ] Create Session Key with template page
- [ ] Activity Page (view latest transactions, for smart accounts and session keys)
- [ ] Identity Page (register ens name, ensip 25, 26 and register 8004 agents)
- [ ] Settings
  - [x] User
    - [x] Profile Page (view and update user profile)
    - [x] Notifications Page (manage notification preferences)
    - [x] Security Page (manage active user sessions)
  - [x] Organization
    - [x] Create Organization Page
    - [x] Update Organization Page (update organization name and metadata)
    - [x] Organization Members Page (see and manage organization members)
    - [x] Invite Members Page (invite new members to organization with a role)
- [x] Accept/Reject Invitation Page (accept/reject invitations to organization)

## Namera Backend

### Routes

- [ ] Auth
  - [x] Core
    - [x] Get Current User
    - [x] List Active Sessions
    - [x] Logout
    - [ ] Revoke Session
    - [x] Revoke Other Sessions
  - [x] Magic Link
    - [x] Sign In Magic Link
    - [x] Verify Magic Link
  - [x] Organization
    - [x] Create Organization
    - [x] List User's Organizations
    - [x] Set Current User's Active Organization
    - [x] Get Organization
    - [x] Update Organization
  - [x] Invitations
    - [x] Invite User to Organization
    - [x] Accept/Reject Invitation
  - [x] Members
    - [x] List Organization Members
    - [x] Update Organization Member
    - [x] Remove Organization Member
  - [x] User
    - [x] Update User
- [ ] Core
  - [x] User Preferences
    - [x] Get User Preferences
    - [x] Update User Preferences
  - [x] Smart Accounts
    - [x] Create Smart Account
    - [x] List Organization's Smart Accounts
  - [x] Session Keys
    - [x] Create Session Key
    - [x] List Session Keys (per organization, and per smart account)
    - [x] Get Session Key Details
  - [ ] Templates
  - [ ] Agents
    - [ ] Register Subname
  - [ ] MCP OAuth 2.1 PCKE Flow
- [x] RPC Proxy
- [x] Health

### Telemetry

- [x] Tracing
- [ ] Metrics

### Emails

- [ ] Resend Integration
- [ ] Subscriber Segments (to send newsletter, announcements from resend website, no code editor)
- [ ] Sync Subscriber lists to database
