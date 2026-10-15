<div className="docs-response">

```json
{
  "id": "0199dfe1-0000-7000-8000-000000000002",
  "organizationId": "0199dfe1-0000-7000-8000-000000000006",
  "walletId": "0199dfe1-0000-7000-8000-000000000001",
  "signingKeyId": "0199dfe1-0000-7000-8000-000000000007",
  "namespace": "eip155",
  "metadata": {
    "version": 1,
    "name": "Local agent"
  },
  "policies": [],
  "policyHash": "9Z4ZzPfiQ4hIUpSXTY_nQ2E9-kjd2w_5wbLwIj7visI",
  "status": "pending",
  "revokedAt": null,
  "createdAt": "2026-10-15T02:39:05.274Z",
  "signer": {
    "custody": "local",
    "algorithm": "secp256k1",
    "publicKey": "0x04118cf91563c3c7b00440980e879331bdac649585ea668f5dfdb0d925ae6bc4bc2ce5449ea5eabee69642fa1b6df0dce03b2dc3e7ae4498878013772fdd155cb6"
  },
  "wallet": {
    "id": "0199dfe1-0000-7000-8000-000000000001",
    "organizationId": "0199dfe1-0000-7000-8000-000000000006",
    "metadata": {
      "version": 1,
      "name": "Provisioned account"
    },
    "status": "active",
    "namespace": "eip155",
    "address": "0x3333333333333333333333333333333333333333",
    "owner": {
      "signingKeyId": "0199dfe1-0000-7000-8000-000000000008",
      "custody": "namera-managed",
      "provider": "1claw",
      "algorithm": "secp256k1"
    },
    "createdAt": "2026-10-15T02:39:05.250Z",
    "updatedAt": "2026-10-15T02:39:05.250Z",
    "implementation": "alchemy-modular-v2",
    "data": {
      "version": 1,
      "modularAccountVersion": "2.0.0",
      "validatorType": "ecdsa_secp256k1",
      "entryPointVersion": "0.7",
      "accountMode": "factory",
      "factoryVersion": "2.0.0",
      "implementationVersion": "v1.0.0",
      "ownerAddress": "0x52e7f17258368d7f9Ebd7bDf8d6869Bc4759aBA1",
      "salt": "0"
    }
  },
  "creator": {
    "type": "api-key",
    "actorId": "0199dfe1-0000-7000-8000-000000000009",
    "id": "0199dfe1-0000-7000-8000-000000000010",
    "metadata": {
      "version": 1,
      "name": "Workspace backend"
    }
  },
  "installations": [
    {
      "id": "0199dfe1-0000-7000-8000-000000000011",
      "chainId": "eip155:11155111",
      "status": "pending",
      "authorization": {
        "version": 1,
        "entityId": 145278918,
        "signerAddress": "0xdA46572b24FF407Cb8979412281cEA774087E5d7",
        "permissions": [
          {
            "type": "root"
          }
        ],
        "allowSignatures": false,
        "validAfter": 1792031945,
        "validUntil": 1792035545
      },
      "installTransactionHash": null,
      "uninstallTransactionHash": null
    }
  ]
}
```

</div>
