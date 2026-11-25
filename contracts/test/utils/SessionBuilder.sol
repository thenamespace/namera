// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {
    ActionData,
    ERC7739Context,
    FALLBACK_TARGET_FLAG,
    FALLBACK_TARGET_SELECTOR_FLAG,
    FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION,
    PolicyData,
    Session
} from "src/smart-sessions/DataTypes.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";

/// @notice Fluent construction of `Session` values in tests.
/// @dev Each `with*` returns the same session for chaining; arrays are copied, so earlier references are not
/// affected.
library SessionBuilder {
    function create(ISessionValidator validator, bytes memory validatorData, bytes32 salt)
        internal
        pure
        returns (Session memory session)
    {
        session.sessionValidator = validator;
        session.sessionValidatorInitData = validatorData;
        session.salt = salt;
    }

    /// @dev Config for `ECDSASessionValidator`; `signers` must be sorted ascending.
    function ecdsaConfig(uint256 threshold, address[] memory signers)
        internal
        pure
        returns (bytes memory)
    {
        return abi.encode(threshold, signers);
    }

    function ecdsaConfig(address signer) internal pure returns (bytes memory) {
        address[] memory signers = new address[](1);
        signers[0] = signer;
        return abi.encode(uint256(1), signers);
    }

    function withUserOpPolicy(Session memory session, address policy, bytes memory initData)
        internal
        pure
        returns (Session memory)
    {
        session.userOpPolicies = _append(session.userOpPolicies, PolicyData(policy, initData));
        return session;
    }

    function withAction(
        Session memory session,
        address target,
        bytes4 selector,
        address policy,
        bytes memory initData
    ) internal pure returns (Session memory) {
        PolicyData[] memory policies = new PolicyData[](1);
        policies[0] = PolicyData(policy, initData);
        return withAction(session, target, selector, policies);
    }

    function withAction(
        Session memory session,
        address target,
        bytes4 selector,
        PolicyData[] memory policies
    ) internal pure returns (Session memory) {
        ActionData[] memory actions = new ActionData[](session.actions.length + 1);
        for (uint256 i; i < session.actions.length; ++i) {
            actions[i] = session.actions[i];
        }
        actions[session.actions.length] = ActionData(selector, target, policies);
        session.actions = actions;
        return session;
    }

    /// @dev Policies applied to every action that has none of its own.
    function withFallbackAction(Session memory session, address policy, bytes memory initData)
        internal
        pure
        returns (Session memory)
    {
        return
            withAction(
                session, FALLBACK_TARGET_FLAG, FALLBACK_TARGET_SELECTOR_FLAG, policy, initData
            );
    }

    /// @dev Policies applied to calls into the SmartSession module itself.
    function withModuleCallAction(Session memory session, address policy, bytes memory initData)
        internal
        pure
        returns (Session memory)
    {
        return withAction(
            session,
            FALLBACK_TARGET_FLAG,
            FALLBACK_TARGET_SELECTOR_FLAG_PERMITTED_TO_CALL_SMARTSESSION,
            policy,
            initData
        );
    }

    function withERC1271Policy(Session memory session, address policy, bytes memory initData)
        internal
        pure
        returns (Session memory)
    {
        session.erc7739Policies.erc1271Policies =
            _append(session.erc7739Policies.erc1271Policies, PolicyData(policy, initData));
        return session;
    }

    function withERC7739Content(
        Session memory session,
        bytes32 appDomainSeparator,
        string memory contentName
    ) internal pure returns (Session memory) {
        string[] memory names = new string[](1);
        names[0] = contentName;
        ERC7739Context[] memory current = session.erc7739Policies.allowedERC7739Content;
        ERC7739Context[] memory contexts = new ERC7739Context[](current.length + 1);
        for (uint256 i; i < current.length; ++i) {
            contexts[i] = current[i];
        }
        contexts[current.length] = ERC7739Context(appDomainSeparator, names);
        session.erc7739Policies.allowedERC7739Content = contexts;
        return session;
    }

    function withValidity(Session memory session, uint48 validAfter, uint48 validUntil)
        internal
        pure
        returns (Session memory)
    {
        session.validAfter = validAfter;
        session.validUntil = validUntil;
        return session;
    }

    function withPaymaster(Session memory session) internal pure returns (Session memory) {
        session.permitERC4337Paymaster = true;
        return session;
    }

    function _append(PolicyData[] memory policies, PolicyData memory policy)
        private
        pure
        returns (PolicyData[] memory result)
    {
        result = new PolicyData[](policies.length + 1);
        for (uint256 i; i < policies.length; ++i) {
            result[i] = policies[i];
        }
        result[policies.length] = policy;
    }
}
