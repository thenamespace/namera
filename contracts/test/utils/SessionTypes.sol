// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

/// @notice EIP-712 type definitions of signed sessions, written independently of HashLib so tests can derive
/// typehashes with `vm.eip712HashType`, which canonicalizes the order of referenced types.
library SessionTypes {
    string internal constant POLICY_DATA = "PolicyData(address policy,bytes initData)";
    string internal constant ACTION_DATA =
        "ActionData(bytes4 actionTargetSelector,address actionTarget,PolicyData[] actionPolicies)";
    string internal constant ERC7739_CONTEXT =
        "ERC7739Context(bytes32 appDomainSeparator,string[] contentName)";
    string internal constant ERC7739_DATA =
        "ERC7739Data(ERC7739Context[] allowedERC7739Content,PolicyData[] erc1271Policies)";
    string internal constant SIGNED_PERMISSIONS =
        "SignedPermissions(bool permitGenericPolicy,bool permitAdminAccess,bool ignoreSecurityAttestations,bool permitERC4337Paymaster,PolicyData[] userOpPolicies,ERC7739Data erc7739Policies,ActionData[] actions)";
    string internal constant SIGNED_SESSION =
        "SignedSession(address account,SignedPermissions permissions,address sessionValidator,bytes sessionValidatorInitData,bytes32 salt,uint48 validAfter,uint48 validUntil,address smartSession,uint256 nonce)";
    string internal constant CHAIN_SESSION = "ChainSession(uint64 chainId,SignedSession session)";
    string internal constant MULTICHAIN_SESSION =
        "MultiChainSession(ChainSession[] sessionsAndChainIds)";

    function erc7739Data() internal pure returns (string memory) {
        return string.concat(ERC7739_DATA, ERC7739_CONTEXT, POLICY_DATA);
    }

    function actionData() internal pure returns (string memory) {
        return string.concat(ACTION_DATA, POLICY_DATA);
    }

    function signedPermissions() internal pure returns (string memory) {
        return
            string.concat(
                SIGNED_PERMISSIONS, ACTION_DATA, ERC7739_CONTEXT, ERC7739_DATA, POLICY_DATA
            );
    }

    function signedSession() internal pure returns (string memory) {
        return string.concat(SIGNED_SESSION, signedPermissions());
    }

    function chainSession() internal pure returns (string memory) {
        return string.concat(CHAIN_SESSION, signedSession());
    }

    function multichainSession() internal pure returns (string memory) {
        return string.concat(MULTICHAIN_SESSION, chainSession());
    }
}
