<div className="docs-response">

```json
{
  "id": "0199dfe1-0000-7000-8000-000000000002",
  "organizationId": "0199dfe1-0000-7000-8000-000000000004",
  "walletId": "0199dfe1-0000-7000-8000-000000000001",
  "signingKeyId": "0199dfe1-0000-7000-8000-000000000006",
  "namespace": "eip155",
  "metadata": {
    "version": 1,
    "name": "Example session",
    "logo": { "type": "emoji", "value": "🔑" },
    "description": "Send 0.001 test ETH on Base Sepolia"
  },
  "policies": [],
  "policyHash": "1111111111111111111111111111111111111111111111111111111111111111",
  "status": "active",
  "revokedAt": null,
  "createdAt": "2026-10-11T09:05:00.000Z",
  "signer": {
    "custody": "namera-managed",
    "provider": "1claw",
    "algorithm": "secp256k1",
    "publicKey": "0x0479be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8"
  },
  "wallet": {
    "id": "0199dfe1-0000-7000-8000-000000000001",
    "organizationId": "0199dfe1-0000-7000-8000-000000000004",
    "metadata": {
      "version": 1,
      "name": "Example account",
      "logo": { "type": "emoji", "value": "👛" },
      "description": "SDK test account"
    },
    "status": "active",
    "namespace": "eip155",
    "address": "0x1111111111111111111111111111111111111111",
    "owner": {
      "signingKeyId": "0199dfe1-0000-7000-8000-000000000005",
      "custody": "namera-managed",
      "provider": "1claw",
      "algorithm": "secp256k1"
    },
    "createdAt": "2026-10-11T09:00:00.000Z",
    "updatedAt": "2026-10-11T09:00:00.000Z",
    "implementation": "alchemy-modular-v2",
    "data": {
      "version": 1,
      "modularAccountVersion": "2.0.0",
      "validatorType": "ecdsa_secp256k1",
      "entryPointVersion": "0.7",
      "accountMode": "7702",
      "delegationVersion": "v1.1.0"
    }
  },
  "creator": {
    "organizationMember": {
      "id": "0199dfe1-0000-7000-8000-000000000007",
      "userId": "0199dfe1-0000-7000-8000-000000000008",
      "organizationId": "0199dfe1-0000-7000-8000-000000000004",
      "organizationRoleId": "0199dfe1-0000-7000-8000-000000000009",
      "joinedAt": "2026-10-11T08:00:00.000Z"
    },
    "user": {
      "id": "0199dfe1-0000-7000-8000-000000000008",
      "email": "developer@example.com",
      "emailVerified": true,
      "metadata": {
        "version": 1,
        "name": "Example developer",
        "image": { "type": "emoji", "value": "👤" }
      },
      "lastLoginAt": "2026-10-11T08:55:00.000Z"
    },
    "organizationRole": {
      "id": "0199dfe1-0000-7000-8000-000000000009",
      "key": "developer",
      "permissions": [
        "wallet:read",
        "wallet:create",
        "session-key:read",
        "session-key:create",
        "api-key:create"
      ],
      "metadata": {
        "version": 1,
        "name": "Developer",
        "logo": { "type": "emoji", "value": "💻" },
        "description": "Manage test accounts and session keys"
      },
      "type": "custom",
      "systemRoleId": null
    }
  },
  "installations": [
    {
      "id": "0199dfe1-0000-7000-8000-000000000010",
      "chainId": "eip155:84532",
      "status": "installed",
      "authorization": {
        "version": 1,
        "entityId": 1,
        "signerAddress": "0x7e5f4552091a69125d5dfcb7b8c2659029395bdf",
        "permissions": [
          { "type": "contract-access", "address": "0x2222222222222222222222222222222222222222" },
          { "type": "native-token-transfer", "allowance": "1000000000000000" }
        ],
        "allowSignatures": false,
        "validAfter": 1791709200,
        "validUntil": 1794387600
      },
      "installTransactionHash": "0x2222222222222222222222222222222222222222222222222222222222222222",
      "uninstallTransactionHash": null
    }
  ]
}
```

</div>
