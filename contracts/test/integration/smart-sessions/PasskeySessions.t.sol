// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {PermissionId, Session, SmartSessionMode} from "src/smart-sessions/DataTypes.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";
import {FlatBytesLib} from "src/smart-sessions/lib/FlatBytesLib.sol";

import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";
import {WebAuthnTestBase} from "../../utils/WebAuthnTestBase.sol";
import {MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

/// @notice Sessions whose key is a set of passkeys, checked by the WebAuthn validator through Smart Sessions. The
/// validator is deployed from its artifact: importing it would compile SmartSession with its optimizer runs too.
contract PasskeySessionsTest is SmartSessionTestBase, WebAuthnTestBase {
    using SessionBuilder for Session;

    /// @dev Regression (config cap): a session validator config holds up to 2,304 bytes, room for 16 passkeys
    /// (96 + 128 × 16 bytes); a session of 16 passkeys is stored whole and any of them signs its operations.
    function test_aSessionOfSixteenPasskeys_isStoredAndSigns() public {
        TestPasskey[] memory passkeys = new TestPasskey[](16);
        for (uint256 i; i < passkeys.length; ++i) {
            passkeys[i] = _passkey(string.concat("passkey ", vm.toString(i)));
        }
        bytes memory config = _installData(1, passkeys);
        assertEq(config.length, 96 + 128 * 16);
        Session memory session = SessionBuilder.create(
                ISessionValidator(vm.deployCode("WebAuthnValidator.sol:WebAuthnValidator")),
                config,
                keccak256("passkeys")
            )
            .withAction(address(target), SET_VALUE, address(policy), MockPolicyConfig.allow());
        PermissionId permissionId = enableSession(session);

        (, bytes memory stored) =
            smartSession.getSessionValidatorAndConfig(address(account), permissionId);
        assertEq(stored, config);

        ERC4337.PackedUserOperation memory op = userOp(callSetValue(1));
        bytes32 challenge = keccak256(abi.encode(userOpHash(op), permissionId));
        op.signature = abi.encodePacked(
            SmartSessionMode.USE,
            permissionId,
            _signature(BACKEND_SOLIDITY, _assert(passkeys[15], challenge))
        );
        assertEq(validate(op), VALID);
    }

    function test_RevertWhen_validatorConfigIsLongerThan2304Bytes() public {
        Session memory session = defaultSession();
        session.sessionValidatorInitData = new bytes(2305);

        vm.expectRevert(abi.encodeWithSelector(FlatBytesLib.DataTooLong.selector, 2305));
        enableSession(session);
    }
}
