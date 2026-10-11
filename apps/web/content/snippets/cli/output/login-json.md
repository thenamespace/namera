<div className="docs-response">

```json
{
  "profile": "personal",
  "status": "connected",
  "actor": {
    "type": "cli",
    "data": {
      "actorId": "0199dfe1-0000-7000-8000-000000000014",
      "organizationId": "0199dfe1-0000-7000-8000-000000000004",
      "organizationName": "Example workspace",
      "grants": [
        {
          "grant": {
            "id": "0199dfe1-0000-7000-8000-000000000013",
            "organizationId": "0199dfe1-0000-7000-8000-000000000004",
            "actorId": "0199dfe1-0000-7000-8000-000000000014",
            "sessionKeyId": "0199dfe1-0000-7000-8000-000000000002",
            "grantedByActorId": "0199dfe1-0000-7000-8000-000000000015",
            "revokedAt": null,
            "revokedByActorId": null,
            "createdAt": "2026-10-11T09:00:00.000Z"
          },
          "sessionKey": {
            "id": "0199dfe1-0000-7000-8000-000000000002",
            "organizationId": "0199dfe1-0000-7000-8000-000000000004",
            "walletId": "0199dfe1-0000-7000-8000-000000000001",
            "signingKeyId": "0199dfe1-0000-7000-8000-000000000005",
            "createdByActorId": "0199dfe1-0000-7000-8000-000000000015",
            "metadata": {
              "version": 1,
              "name": "Example session",
              "logo": { "type": "emoji", "value": "🔑" },
              "description": "SDK test session"
            },
            "policyHash": "0x3333333333333333333333333333333333333333333333333333333333333333",
            "status": "active",
            "revokedAt": null,
            "revokedByActorId": null,
            "createdAt": "2026-10-11T09:00:00.000Z",
            "namespace": "eip155",
            "policies": [
              {
                "id": "0199dfe1-0000-7000-8000-000000000016",
                "appliesTo": "both",
                "type": "evm.chain-allowlist",
                "version": 1,
                "chainIds": ["eip155:84532"]
              }
            ]
          }
        }
      ],
      "authorization": {
        "id": "0199dfe1-0000-7000-8000-000000000017",
        "clientId": "0199dfe1-0000-7000-8000-000000000018",
        "scopes": [
          "wallet:read",
          "session-key:read",
          "execution:read",
          "execution:execute",
          "signature:create",
          "offline_access"
        ],
        "metadata": {
          "type": "cli",
          "version": 1,
          "deviceName": "Example laptop",
          "cliVersion": "1.2.0",
          "platform": "darwin"
        },
        "expiresAt": null,
        "lastUsedAt": "2026-10-11T09:10:00.000Z",
        "createdAt": "2026-10-11T09:00:00.000Z"
      }
    }
  }
}
```

</div>
