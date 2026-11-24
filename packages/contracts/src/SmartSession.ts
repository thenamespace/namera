import type * as Contract from "./Contract.ts"

const abiV1 = [
  {
    "type": "function",
    "name": "areActionsEnabled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, {
      "name": "actions",
      "type": "tuple[]",
      "internalType": "struct ActionData[]",
      "components": [{ "name": "actionTargetSelector", "type": "bytes4", "internalType": "bytes4" }, {
        "name": "actionTarget",
        "type": "address",
        "internalType": "address"
      }, {
        "name": "actionPolicies",
        "type": "tuple[]",
        "internalType": "struct PolicyData[]",
        "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
          "name": "initData",
          "type": "bytes",
          "internalType": "bytes"
        }]
      }]
    }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "areERC1271PoliciesEnabled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, {
      "name": "erc1271Policies",
      "type": "tuple[]",
      "internalType": "struct PolicyData[]",
      "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
        "name": "initData",
        "type": "bytes",
        "internalType": "bytes"
      }]
    }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "areUserOpPoliciesEnabled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, {
      "name": "userOpPolicies",
      "type": "tuple[]",
      "internalType": "struct PolicyData[]",
      "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
        "name": "initData",
        "type": "bytes",
        "internalType": "bytes"
      }]
    }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "disableActionId",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "actionId",
      "type": "bytes32",
      "internalType": "ActionId"
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "disableActionPolicies",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "actionId",
      "type": "bytes32",
      "internalType": "ActionId"
    }, { "name": "policies", "type": "address[]", "internalType": "address[]" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "disableERC1271Policies",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "policies",
      "type": "address[]",
      "internalType": "address[]"
    }, {
      "name": "contexts",
      "type": "tuple[]",
      "internalType": "struct ERC7739Context[]",
      "components": [{ "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" }, {
        "name": "contentNames",
        "type": "string[]",
        "internalType": "string[]"
      }]
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "disableUserOpPolicies",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "policies",
      "type": "address[]",
      "internalType": "address[]"
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableActionPolicies",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "actionPolicies",
      "type": "tuple[]",
      "internalType": "struct ActionData[]",
      "components": [{ "name": "actionTargetSelector", "type": "bytes4", "internalType": "bytes4" }, {
        "name": "actionTarget",
        "type": "address",
        "internalType": "address"
      }, {
        "name": "actionPolicies",
        "type": "tuple[]",
        "internalType": "struct PolicyData[]",
        "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
          "name": "initData",
          "type": "bytes",
          "internalType": "bytes"
        }]
      }]
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableERC1271Policies",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "erc1271Policies",
      "type": "tuple",
      "internalType": "struct ERC7739Data",
      "components": [{
        "name": "allowedERC7739Content",
        "type": "tuple[]",
        "internalType": "struct ERC7739Context[]",
        "components": [{ "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" }, {
          "name": "contentNames",
          "type": "string[]",
          "internalType": "string[]"
        }]
      }, {
        "name": "erc1271Policies",
        "type": "tuple[]",
        "internalType": "struct PolicyData[]",
        "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
          "name": "initData",
          "type": "bytes",
          "internalType": "bytes"
        }]
      }]
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableSessions",
    "inputs": [{
      "name": "sessions",
      "type": "tuple[]",
      "internalType": "struct Session[]",
      "components": [
        { "name": "sessionValidator", "type": "address", "internalType": "contract ISessionValidator" },
        { "name": "sessionValidatorInitData", "type": "bytes", "internalType": "bytes" },
        { "name": "salt", "type": "bytes32", "internalType": "bytes32" },
        {
          "name": "userOpPolicies",
          "type": "tuple[]",
          "internalType": "struct PolicyData[]",
          "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
            "name": "initData",
            "type": "bytes",
            "internalType": "bytes"
          }]
        },
        {
          "name": "erc7739Policies",
          "type": "tuple",
          "internalType": "struct ERC7739Data",
          "components": [{
            "name": "allowedERC7739Content",
            "type": "tuple[]",
            "internalType": "struct ERC7739Context[]",
            "components": [{ "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" }, {
              "name": "contentNames",
              "type": "string[]",
              "internalType": "string[]"
            }]
          }, {
            "name": "erc1271Policies",
            "type": "tuple[]",
            "internalType": "struct PolicyData[]",
            "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
              "name": "initData",
              "type": "bytes",
              "internalType": "bytes"
            }]
          }]
        },
        {
          "name": "actions",
          "type": "tuple[]",
          "internalType": "struct ActionData[]",
          "components": [{ "name": "actionTargetSelector", "type": "bytes4", "internalType": "bytes4" }, {
            "name": "actionTarget",
            "type": "address",
            "internalType": "address"
          }, {
            "name": "actionPolicies",
            "type": "tuple[]",
            "internalType": "struct PolicyData[]",
            "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
              "name": "initData",
              "type": "bytes",
              "internalType": "bytes"
            }]
          }]
        },
        { "name": "permitERC4337Paymaster", "type": "bool", "internalType": "bool" },
        { "name": "validAfter", "type": "uint48", "internalType": "uint48" },
        { "name": "validUntil", "type": "uint48", "internalType": "uint48" }
      ]
    }],
    "outputs": [{ "name": "permissionIds", "type": "bytes32[]", "internalType": "PermissionId[]" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "enableUserOpPolicies",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "userOpPolicies",
      "type": "tuple[]",
      "internalType": "struct PolicyData[]",
      "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
        "name": "initData",
        "type": "bytes",
        "internalType": "bytes"
      }]
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "getActionPolicies",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, { "name": "actionId", "type": "bytes32", "internalType": "ActionId" }],
    "outputs": [{ "name": "", "type": "address[]", "internalType": "address[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getERC1271Policies",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }],
    "outputs": [{ "name": "", "type": "address[]", "internalType": "address[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEnabledActions",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }],
    "outputs": [{ "name": "", "type": "bytes32[]", "internalType": "bytes32[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getEnabledERC7739Content",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }],
    "outputs": [{
      "name": "contents",
      "type": "tuple[]",
      "internalType": "struct ERC7739ContextHashes[]",
      "components": [{ "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" }, {
        "name": "contentNameHashes",
        "type": "bytes32[]",
        "internalType": "bytes32[]"
      }]
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getNonce",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "uint256" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPermissionIDs",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "permissionIds", "type": "bytes32[]", "internalType": "PermissionId[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getPermissionId",
    "inputs": [{
      "name": "session",
      "type": "tuple",
      "internalType": "struct Session",
      "components": [
        { "name": "sessionValidator", "type": "address", "internalType": "contract ISessionValidator" },
        { "name": "sessionValidatorInitData", "type": "bytes", "internalType": "bytes" },
        { "name": "salt", "type": "bytes32", "internalType": "bytes32" },
        {
          "name": "userOpPolicies",
          "type": "tuple[]",
          "internalType": "struct PolicyData[]",
          "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
            "name": "initData",
            "type": "bytes",
            "internalType": "bytes"
          }]
        },
        {
          "name": "erc7739Policies",
          "type": "tuple",
          "internalType": "struct ERC7739Data",
          "components": [{
            "name": "allowedERC7739Content",
            "type": "tuple[]",
            "internalType": "struct ERC7739Context[]",
            "components": [{ "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" }, {
              "name": "contentNames",
              "type": "string[]",
              "internalType": "string[]"
            }]
          }, {
            "name": "erc1271Policies",
            "type": "tuple[]",
            "internalType": "struct PolicyData[]",
            "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
              "name": "initData",
              "type": "bytes",
              "internalType": "bytes"
            }]
          }]
        },
        {
          "name": "actions",
          "type": "tuple[]",
          "internalType": "struct ActionData[]",
          "components": [{ "name": "actionTargetSelector", "type": "bytes4", "internalType": "bytes4" }, {
            "name": "actionTarget",
            "type": "address",
            "internalType": "address"
          }, {
            "name": "actionPolicies",
            "type": "tuple[]",
            "internalType": "struct PolicyData[]",
            "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
              "name": "initData",
              "type": "bytes",
              "internalType": "bytes"
            }]
          }]
        },
        { "name": "permitERC4337Paymaster", "type": "bool", "internalType": "bool" },
        { "name": "validAfter", "type": "uint48", "internalType": "uint48" },
        { "name": "validUntil", "type": "uint48", "internalType": "uint48" }
      ]
    }],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "PermissionId" }],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "getSessionDigest",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }, {
      "name": "session",
      "type": "tuple",
      "internalType": "struct Session",
      "components": [
        { "name": "sessionValidator", "type": "address", "internalType": "contract ISessionValidator" },
        { "name": "sessionValidatorInitData", "type": "bytes", "internalType": "bytes" },
        { "name": "salt", "type": "bytes32", "internalType": "bytes32" },
        {
          "name": "userOpPolicies",
          "type": "tuple[]",
          "internalType": "struct PolicyData[]",
          "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
            "name": "initData",
            "type": "bytes",
            "internalType": "bytes"
          }]
        },
        {
          "name": "erc7739Policies",
          "type": "tuple",
          "internalType": "struct ERC7739Data",
          "components": [{
            "name": "allowedERC7739Content",
            "type": "tuple[]",
            "internalType": "struct ERC7739Context[]",
            "components": [{ "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" }, {
              "name": "contentNames",
              "type": "string[]",
              "internalType": "string[]"
            }]
          }, {
            "name": "erc1271Policies",
            "type": "tuple[]",
            "internalType": "struct PolicyData[]",
            "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
              "name": "initData",
              "type": "bytes",
              "internalType": "bytes"
            }]
          }]
        },
        {
          "name": "actions",
          "type": "tuple[]",
          "internalType": "struct ActionData[]",
          "components": [{ "name": "actionTargetSelector", "type": "bytes4", "internalType": "bytes4" }, {
            "name": "actionTarget",
            "type": "address",
            "internalType": "address"
          }, {
            "name": "actionPolicies",
            "type": "tuple[]",
            "internalType": "struct PolicyData[]",
            "components": [{ "name": "policy", "type": "address", "internalType": "address" }, {
              "name": "initData",
              "type": "bytes",
              "internalType": "bytes"
            }]
          }]
        },
        { "name": "permitERC4337Paymaster", "type": "bool", "internalType": "bool" },
        { "name": "validAfter", "type": "uint48", "internalType": "uint48" },
        { "name": "validUntil", "type": "uint48", "internalType": "uint48" }
      ]
    }, { "name": "mode", "type": "uint8", "internalType": "enum SmartSessionMode" }],
    "outputs": [{ "name": "", "type": "bytes32", "internalType": "bytes32" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSessionValidatorAndConfig",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }],
    "outputs": [{ "name": "sessionValidator", "type": "address", "internalType": "address" }, {
      "name": "sessionValidatorData",
      "type": "bytes",
      "internalType": "bytes"
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getSessionValidity",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }],
    "outputs": [{ "name": "validAfter", "type": "uint48", "internalType": "uint48" }, {
      "name": "validUntil",
      "type": "uint48",
      "internalType": "uint48"
    }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "getUserOpPolicies",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }],
    "outputs": [{ "name": "", "type": "address[]", "internalType": "address[]" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isActionIdEnabled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, { "name": "actionId", "type": "bytes32", "internalType": "ActionId" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isActionPolicyEnabled",
    "inputs": [
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" },
      { "name": "actionId", "type": "bytes32", "internalType": "ActionId" },
      { "name": "policy", "type": "address", "internalType": "address" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isERC1271PolicyEnabled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, { "name": "policy", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isERC7739ContentEnabled",
    "inputs": [
      { "name": "account", "type": "address", "internalType": "address" },
      { "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" },
      { "name": "appDomainSeparator", "type": "bytes32", "internalType": "bytes32" },
      { "name": "content", "type": "string", "internalType": "string" }
    ],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isISessionValidatorSet",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isInitialized",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isModuleType",
    "inputs": [{ "name": "moduleTypeId", "type": "uint256", "internalType": "uint256" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "pure"
  },
  {
    "type": "function",
    "name": "isPermissionEnabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isUserOpPolicyEnabled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "permissionId",
      "type": "bytes32",
      "internalType": "PermissionId"
    }, { "name": "policy", "type": "address", "internalType": "address" }],
    "outputs": [{ "name": "", "type": "bool", "internalType": "bool" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "isValidSignatureWithSender",
    "inputs": [{ "name": "sender", "type": "address", "internalType": "address" }, {
      "name": "hash",
      "type": "bytes32",
      "internalType": "bytes32"
    }, { "name": "signature", "type": "bytes", "internalType": "bytes" }],
    "outputs": [{ "name": "result", "type": "bytes4", "internalType": "bytes4" }],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "onInstall",
    "inputs": [{ "name": "data", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "onUninstall",
    "inputs": [{ "name": "", "type": "bytes", "internalType": "bytes" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "removeSession",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "revokeEnableSignature",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "setPermit4337Paymaster",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "enabled",
      "type": "bool",
      "internalType": "bool"
    }],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "validateUserOp",
    "inputs": [{
      "name": "userOp",
      "type": "tuple",
      "internalType": "struct ERC4337.PackedUserOperation",
      "components": [
        { "name": "sender", "type": "address", "internalType": "address" },
        { "name": "nonce", "type": "uint256", "internalType": "uint256" },
        { "name": "initCode", "type": "bytes", "internalType": "bytes" },
        { "name": "callData", "type": "bytes", "internalType": "bytes" },
        { "name": "accountGasLimits", "type": "bytes32", "internalType": "bytes32" },
        { "name": "preVerificationGas", "type": "uint256", "internalType": "uint256" },
        { "name": "gasFees", "type": "bytes32", "internalType": "bytes32" },
        { "name": "paymasterAndData", "type": "bytes", "internalType": "bytes" },
        { "name": "signature", "type": "bytes", "internalType": "bytes" }
      ]
    }, { "name": "userOpHash", "type": "bytes32", "internalType": "bytes32" }],
    "outputs": [{ "name": "", "type": "uint256", "internalType": "ValidationData" }],
    "stateMutability": "nonpayable"
  },
  {
    "type": "event",
    "name": "ActionIdDisabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "actionId",
      "type": "bytes32",
      "indexed": false,
      "internalType": "ActionId"
    }, { "name": "smartAccount", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "NonceIterated",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "newValue", "type": "uint256", "indexed": false, "internalType": "uint256" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PermissionIdPermit4337Paymaster",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "smartAccount",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "enabled", "type": "bool", "indexed": false, "internalType": "bool" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyDisabled",
    "inputs": [
      { "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" },
      { "name": "policyType", "type": "uint8", "indexed": false, "internalType": "enum PolicyType" },
      { "name": "policy", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "smartAccount", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "PolicyEnabled",
    "inputs": [
      { "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" },
      { "name": "policyType", "type": "uint8", "indexed": false, "internalType": "enum PolicyType" },
      { "name": "policy", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "smartAccount", "type": "address", "indexed": false, "internalType": "address" }
    ],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionCreated",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionRemoved",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "smartAccount",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionValidatorDisabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "sessionValidator",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "smartAccount", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionValidatorEnabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" }, {
      "name": "sessionValidator",
      "type": "address",
      "indexed": false,
      "internalType": "address"
    }, { "name": "smartAccount", "type": "address", "indexed": false, "internalType": "address" }],
    "anonymous": false
  },
  {
    "type": "event",
    "name": "SessionValiditySet",
    "inputs": [
      { "name": "permissionId", "type": "bytes32", "indexed": false, "internalType": "PermissionId" },
      { "name": "smartAccount", "type": "address", "indexed": false, "internalType": "address" },
      { "name": "validAfter", "type": "uint48", "indexed": false, "internalType": "uint48" },
      { "name": "validUntil", "type": "uint48", "indexed": false, "internalType": "uint48" }
    ],
    "anonymous": false
  },
  {
    "type": "error",
    "name": "AssociatedArray_OutOfBounds",
    "inputs": [{ "name": "index", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "AssociatedArray_OutOfBounds",
    "inputs": [{ "name": "index", "type": "uint256", "internalType": "uint256" }]
  },
  {
    "type": "error",
    "name": "ChainIdMismatch",
    "inputs": [{ "name": "providedChainId", "type": "uint64", "internalType": "uint64" }]
  },
  {
    "type": "error",
    "name": "DataTooLong",
    "inputs": [{ "name": "length", "type": "uint256", "internalType": "uint256" }]
  },
  { "type": "error", "name": "ForbiddenValidationData", "inputs": [] },
  {
    "type": "error",
    "name": "HashMismatch",
    "inputs": [{ "name": "providedHash", "type": "bytes32", "internalType": "bytes32" }, {
      "name": "computedHash",
      "type": "bytes32",
      "internalType": "bytes32"
    }]
  },
  { "type": "error", "name": "InvalidActionId", "inputs": [] },
  { "type": "error", "name": "InvalidData", "inputs": [] },
  {
    "type": "error",
    "name": "InvalidEnableSignature",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }, {
      "name": "hash",
      "type": "bytes32",
      "internalType": "bytes32"
    }]
  },
  {
    "type": "error",
    "name": "InvalidISessionValidator",
    "inputs": [{ "name": "sessionValidator", "type": "address", "internalType": "contract ISessionValidator" }]
  },
  { "type": "error", "name": "InvalidMode", "inputs": [] },
  {
    "type": "error",
    "name": "InvalidPermissionId",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }]
  },
  { "type": "error", "name": "InvalidSelfCall", "inputs": [] },
  {
    "type": "error",
    "name": "InvalidSession",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }]
  },
  {
    "type": "error",
    "name": "InvalidSessionHookTag",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }]
  },
  {
    "type": "error",
    "name": "InvalidSessionValidity",
    "inputs": [{ "name": "validAfter", "type": "uint48", "internalType": "uint48" }, {
      "name": "validUntil",
      "type": "uint48",
      "internalType": "uint48"
    }]
  },
  { "type": "error", "name": "InvalidTarget", "inputs": [] },
  {
    "type": "error",
    "name": "InvalidUserOpSender",
    "inputs": [{ "name": "sender", "type": "address", "internalType": "address" }]
  },
  { "type": "error", "name": "NoExecutionsInBatch", "inputs": [] },
  {
    "type": "error",
    "name": "NoPoliciesSet",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }]
  },
  {
    "type": "error",
    "name": "PaymasterValidationNotEnabled",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }]
  },
  {
    "type": "error",
    "name": "PolicyViolation",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "policy",
      "type": "address",
      "internalType": "address"
    }]
  },
  {
    "type": "error",
    "name": "SignerNotFound",
    "inputs": [{ "name": "permissionId", "type": "bytes32", "internalType": "PermissionId" }, {
      "name": "account",
      "type": "address",
      "internalType": "address"
    }]
  },
  {
    "type": "error",
    "name": "SmartSessionModuleAlreadyInstalled",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "UnsupportedAccount",
    "inputs": [{ "name": "account", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "UnsupportedCallType",
    "inputs": [{ "name": "callType", "type": "bytes1", "internalType": "bytes1" }]
  },
  { "type": "error", "name": "UnsupportedExecutionType", "inputs": [] },
  {
    "type": "error",
    "name": "UnsupportedPolicy",
    "inputs": [{ "name": "policy", "type": "address", "internalType": "address" }]
  },
  {
    "type": "error",
    "name": "UnsupportedSmartSessionMode",
    "inputs": [{ "name": "mode", "type": "uint8", "internalType": "enum SmartSessionMode" }]
  }
] as const

/**
 * Version 1 of Namera's `SmartSession` contract (`namera.smart-session.v1`): its ABI, CREATE2
 * address and the record of every chain it is deployed on.
 *
 * **Details**
 *
 * The address commits to the salt `keccak256(label)` and to the initcode built with solc
 * 0.8.38+commit.1835d247 for `cancun` (200 optimizer runs, via-IR), so it is the same on every
 * chain.
 *
 * @stability experimental
 * @category contracts
 * @since 2.0.0
 */
export const v1: Contract.Version<typeof abiV1> = {
  "label": "namera.smart-session.v1",
  "address": "0x26e62071c25F003BA503898e0d716Cd98CEF6e80",
  "factory": "0x4e59b44847b379578588920cA78FbF26c0B4956C",
  "salt": "0xe5477940b2a0ba409edc569d78a14f3f55213a84dcbc656ead555a2d5e6fe9c9",
  "initcodeHash": "0xe52ddf284d3e18192453afab9b56626e0005b40b9d384e5a511b9cd5c7ca7ddb",
  "compiler": { "compiler": "0.8.38+commit.1835d247", "evmVersion": "cancun", "optimizerRuns": 200, "viaIR": true },
  "abi": abiV1,
  "deployments": {
    8453: {
      "runtimeCodeHash": "0xd698d06f9e2d93beabe240e688147e83b595300cc0b3d2df33ab4418db176797",
      "transactionHash": "0xd2630435446ada9297fb959098c64b09574a4ee139431ff7f1082384fad4e95e",
      "blockNumber": BigInt("61800554"),
      "blockHash": "0xe6c388e40301a4db133c8214e8f607f6eb0969ce92f1af062c5eb3d61d3fa019",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    },
    84532: {
      "runtimeCodeHash": "0xd698d06f9e2d93beabe240e688147e83b595300cc0b3d2df33ab4418db176797",
      "transactionHash": "0x383d1c7b6123f1d0497bc4068da94245a785ea97d9e12af59965cf95cf12ca50",
      "blockNumber": BigInt("63140054"),
      "blockHash": "0x8518e8e91d40e02fdb2daeab57a710629dc672e99ab3cbce9e6e7e98867dc9dd",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    },
    421614: {
      "runtimeCodeHash": "0xd698d06f9e2d93beabe240e688147e83b595300cc0b3d2df33ab4418db176797",
      "transactionHash": "0x1eac2f4511ac4e76931e391b200fc333c91c4c37a4faad19e7360a3b411247a5",
      "blockNumber": BigInt("332385624"),
      "blockHash": "0xde1bb02e4d0d1666869a1369018fa6ee797815adeb1a936b9f3791e96455051a",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    },
    11155111: {
      "runtimeCodeHash": "0xd698d06f9e2d93beabe240e688147e83b595300cc0b3d2df33ab4418db176797",
      "transactionHash": "0x245508e14f7f4be58725483da65bae9b93edb24af6787124675fca352482ef38",
      "blockNumber": BigInt("12204736"),
      "blockHash": "0xd7caf178dd4d80e07a0cc19c2c366b932059983d3456bc317f88a136e2a8c4c8",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    },
    11155420: {
      "runtimeCodeHash": "0xd698d06f9e2d93beabe240e688147e83b595300cc0b3d2df33ab4418db176797",
      "transactionHash": "0xe478538f810ba7a6fb58d61c3161d643320ba0b31d00d3d59339fa0d31c502a2",
      "blockNumber": BigInt("51873769"),
      "blockHash": "0xdf4cfcc9422a6c731c8bcfd676ab4fe5bb7a367ad99640020cf913b6e757570b",
      "deployer": "0xA1f0cf3974F1023FbD16322a137dad3A538eB6c6",
      "source": {
        "commit": "34564781592a433d7fea777752d8c0854b5aed55",
        "compiler": "0.8.38+commit.1835d247",
        "evmVersion": "cancun",
        "optimizerRuns": 200,
        "viaIR": true
      }
    }
  }
}
