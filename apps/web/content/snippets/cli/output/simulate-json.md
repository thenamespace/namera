<div className="docs-response">

```json
{
  "namespace": "eip155",
  "walletId": "0199dfe1-0000-7000-8000-000000000001",
  "chainId": "eip155:84532",
  "account": "0x1111111111111111111111111111111111111111",
  "callsSucceeded": true,
  "simulation": {
    "userOperation": {
      "source": "eth_estimateUserOperationGas",
      "callGasLimit": "50000",
      "verificationGasLimit": "100000",
      "preVerificationGas": "50000",
      "maxFeePerGas": "1000000000",
      "maxPriorityFeePerGas": "1000000"
    },
    "calls": {
      "source": "viem.simulateCalls",
      "results": [{ "status": "success", "returnData": "0x", "gasUsed": "21000" }],
      "assetChanges": [],
      "transfers": [
        {
          "callIndex": 0,
          "from": "0x1111111111111111111111111111111111111111",
          "to": "0x2222222222222222222222222222222222222222",
          "value": "1000000000000000"
        }
      ]
    }
  },
  "allowed": true,
  "sessionKeyId": "0199dfe1-0000-7000-8000-000000000002"
}
```

</div>
