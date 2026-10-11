<div className="docs-response">

```json
{
  "profile": "automation",
  "actor": {
    "type": "api-key",
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
      "apiKey": {
        "id": "0199dfe1-0000-7000-8000-000000000017",
        "metadata": {
          "version": 1,
          "name": "Example integration",
          "logo": { "type": "emoji", "value": "🔑" },
          "description": "SDK test credential"
        },
        "keyStart": "example-prefix",
        "expiresAt": null,
        "lastUsedAt": "2026-10-11T09:10:00.000Z",
        "createdAt": "2026-10-11T09:00:00.000Z"
      }
    }
  }
}
```

</div>
