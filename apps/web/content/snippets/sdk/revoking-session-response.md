<div className="docs-response">

```json
{
  "id": "0199dfe1-0000-7000-8000-000000001000",
  "organizationId": "0199dfe1-0000-7000-8000-000000001001",
  "walletId": "0199dfe1-0000-7000-8000-000000001002",
  "signingKeyId": "0199dfe1-0000-7000-8000-000000001003",
  "namespace": "eip155",
  "metadata": {
    "version": 1,
    "name": "Local agent"
  },
  "policies": [],
  "policyHash": "9Z4ZzPfiQ4hIUpSXTY_nQ2E9-kjd2w_5wbLwIj7visI",
  "status": "revoking",
  "revokedAt": "2026-10-15T02:57:34.211Z",
  "createdAt": "2026-10-15T02:57:32.375Z",
  "signer": {
    "custody": "local",
    "algorithm": "secp256k1",
    "publicKey": "0x04c70cd5e6b1350f36bb3f47e4c50f276178a843ddc457189b962b660b81945ccee5bd6e75bbf22348c1ece286baeec6776e5cc66206f2b5de96cf0c8a0ca407e1"
  },
  "wallet": {
    "id": "0199dfe1-0000-7000-8000-000000001002",
    "organizationId": "0199dfe1-0000-7000-8000-000000001001",
    "metadata": {
      "version": 1,
      "name": "Managed owner"
    },
    "status": "active",
    "namespace": "eip155",
    "address": "0x3333333333333333333333333333333333333333",
    "owner": {
      "signingKeyId": "0199dfe1-0000-7000-8000-000000001004",
      "custody": "namera-managed",
      "provider": "1claw",
      "algorithm": "secp256k1"
    },
    "createdAt": "2026-10-15T02:57:32.345Z",
    "updatedAt": "2026-10-15T02:57:32.345Z",
    "implementation": "alchemy-modular-v2",
    "data": {
      "version": 1,
      "modularAccountVersion": "2.0.0",
      "validatorType": "ecdsa_secp256k1",
      "entryPointVersion": "0.7",
      "accountMode": "factory",
      "factoryVersion": "2.0.0",
      "implementationVersion": "v1.0.0",
      "ownerAddress": "0x90C59223ac50061f5204826078944ec41bc56e0d",
      "salt": "0"
    }
  },
  "creator": {
    "organizationMember": {
      "id": "0199dfe1-0000-7000-8000-000000001005",
      "userId": "0199dfe1-0000-7000-8000-000000001006",
      "organizationId": "0199dfe1-0000-7000-8000-000000001001",
      "organizationRoleId": "0199dfe1-0000-7000-8000-000000001007",
      "joinedAt": "2026-10-15T02:57:32.244Z"
    },
    "user": {
      "id": "0199dfe1-0000-7000-8000-000000001006",
      "email": "0199dfe1-0000-7000-8000-000000001008@example.com",
      "emailVerified": true,
      "metadata": {
        "version": 1
      },
      "lastLoginAt": "2026-10-15T02:57:32.211Z"
    },
    "organizationRole": {
      "id": "0199dfe1-0000-7000-8000-000000001007",
      "key": "owner",
      "permissions": [
        "organization:read",
        "organization:update",
        "member:read",
        "member:update",
        "member:remove",
        "invitation:read",
        "invitation:create",
        "invitation:cancel",
        "role:read",
        "role:create",
        "role:update",
        "role:delete",
        "billing:read",
        "billing:update",
        "billing:cancel",
        "wallet:read",
        "wallet:create",
        "wallet:update",
        "session-key:read",
        "session-key:create",
        "session-key:revoke",
        "api-key:read",
        "api-key:create",
        "api-key:revoke",
        "execution:read",
        "mcp-authorization:read",
        "mcp-authorization:create",
        "mcp-authorization:revoke",
        "cli-authorization:read",
        "cli-authorization:create",
        "cli-authorization:revoke"
      ],
      "metadata": {
        "version": 1,
        "name": "Owner",
        "description": "Organization owner with full access"
      },
      "type": "system",
      "systemRoleId": "0199dfe1-0000-7000-8000-000000001009"
    }
  },
  "installations": [
    {
      "id": "0199dfe1-0000-7000-8000-000000001010",
      "chainId": "eip155:11155111",
      "status": "installed",
      "authorization": {
        "version": 1,
        "entityId": 94541820,
        "signerAddress": "0xAB592704Fde287292b3a886Db80C0B6e7AC6DAdc",
        "permissions": [
          {
            "type": "root"
          }
        ],
        "allowSignatures": false,
        "validAfter": 1792033052,
        "validUntil": 1792036652
      },
      "installTransactionHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
      "uninstallTransactionHash": null
    }
  ]
}
```

</div>
