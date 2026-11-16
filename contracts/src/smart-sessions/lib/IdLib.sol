// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.38;

import {
    ActionId,
    ActionPolicyId,
    ConfigId,
    Erc1271PolicyId,
    PermissionId,
    Session,
    UserOpPolicyId
} from "../DataTypes.sol";

library IdLib {
    bytes4 internal constant VALUE_SELECTOR = 0xFFFFFFFF;

    function toUserOpPolicyId(PermissionId permissionId) internal pure returns (UserOpPolicyId) {
        return UserOpPolicyId.wrap(PermissionId.unwrap(permissionId));
    }

    function toActionId(address target, bytes4 functionSelector) internal pure returns (ActionId) {
        return ActionId.wrap(keccak256(abi.encodePacked(target, functionSelector)));
    }

    function toActionPolicyId(PermissionId permissionId, ActionId actionId)
        internal
        pure
        returns (ActionPolicyId)
    {
        return ActionPolicyId.wrap(keccak256(abi.encodePacked(permissionId, actionId)));
    }

    function toErc1271PolicyId(PermissionId permissionId) internal pure returns (Erc1271PolicyId) {
        return Erc1271PolicyId.wrap(keccak256(abi.encodePacked("ERC1271: ", permissionId)));
    }

    function toConfigId(UserOpPolicyId userOpPolicyId) internal view returns (ConfigId) {
        return ConfigId.wrap(keccak256(abi.encodePacked(msg.sender, userOpPolicyId)));
    }

    function toConfigId(PermissionId permissionId, ActionId actionId)
        internal
        view
        returns (ConfigId)
    {
        return ConfigId.wrap(
            keccak256(abi.encodePacked(msg.sender, toActionPolicyId(permissionId, actionId)))
        );
    }

    function toConfigId(Erc1271PolicyId erc1271PolicyId) internal view returns (ConfigId) {
        return ConfigId.wrap(keccak256(abi.encodePacked(msg.sender, erc1271PolicyId)));
    }

    function toPermissionIdMemory(Session memory session) internal pure returns (PermissionId) {
        return PermissionId.wrap(
            keccak256(
                abi.encode(session.sessionValidator, session.sessionValidatorInitData, session.salt)
            )
        );
    }

    function toPermissionId(Session calldata session) internal pure returns (PermissionId) {
        return PermissionId.wrap(
            keccak256(
                abi.encode(session.sessionValidator, session.sessionValidatorInitData, session.salt)
            )
        );
    }
}
