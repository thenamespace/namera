<div className="docs-response">

```json
{
  "operationId": "0199dfe1-0000-7000-8000-000000001011",
  "namespace": "eip155",
  "approval": "1claw",
  "prepared": {
    "version": 1,
    "namespace": "eip155",
    "chainId": "eip155:11155111",
    "entryPointVersion": "0.7",
    "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "sponsorship": "none",
    "context": {
      "version": 1,
      "namespace": "eip155",
      "chainId": "eip155:11155111",
      "account": "0x3333333333333333333333333333333333333333",
      "block": {
        "number": "0",
        "hash": "0x0000000000000000000000000000000000000000000000000000000000000000",
        "timestamp": "1970-01-01T00:00:00.000Z"
      },
      "calls": [
        {
          "to": "0x3333333333333333333333333333333333333333",
          "value": "0",
          "data": "0xabcd"
        }
      ],
      "userOperation": {
        "nonce": "0",
        "gas": {
          "callGasLimit": "0",
          "verificationGasLimit": "0",
          "preVerificationGas": "0",
          "paymasterVerificationGasLimit": "0",
          "paymasterPostOpGasLimit": "0",
          "maxFeePerGas": "0",
          "maxPriorityFeePerGas": "0"
        },
        "paymaster": null
      },
      "simulation": {
        "userOperation": {
          "source": "eth_estimateUserOperationGas",
          "callGasLimit": "0",
          "verificationGasLimit": "0",
          "preVerificationGas": "0",
          "maxFeePerGas": "1000000000",
          "maxPriorityFeePerGas": "1"
        },
        "calls": {
          "source": "viem.simulateCalls",
          "results": [
            {
              "status": "success",
              "returnData": "0x",
              "gasUsed": "0"
            }
          ],
          "assetChanges": [],
          "transfers": []
        }
      }
    },
    "userOperation": {
      "sender": "0x3333333333333333333333333333333333333333",
      "nonce": "0",
      "callData": "0x",
      "callGasLimit": "0",
      "verificationGasLimit": "0",
      "preVerificationGas": "0",
      "maxFeePerGas": "0",
      "maxPriorityFeePerGas": "0",
      "signature": "0x"
    },
    "billing": {
      "executionMeter": "execution.testnet",
      "sponsorship": null
    }
  },
  "expiresAt": "2026-10-15T03:02:34.211Z"
}
```

</div>
