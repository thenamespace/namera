// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {WebAuthnValidator} from "src/validators/WebAuthnValidator.sol";
import {WebAuthnAssertion} from "src/validators/lib/WebAuthnAssertion.sol";

import {PasskeyHandler} from "./handlers/PasskeyHandler.sol";

contract WebAuthnValidatorInvariantsTest is Test {
    WebAuthnValidator internal validator;
    PasskeyHandler internal handler;

    function setUp() public {
        validator = new WebAuthnValidator();
        handler = new PasskeyHandler(validator);
        targetContract(address(handler));
    }

    function invariant_accountsAlwaysKeepAUsableConfig() public view {
        for (uint256 a; a < 2; ++a) {
            (uint256 threshold, bytes32[] memory ids,) = validator.getPasskeys(handler.accounts(a));
            assertGt(ids.length, 0);
            assertLe(ids.length, validator.MAX_PASSKEYS());
            assertGt(threshold, 0);
            assertLe(threshold, ids.length);
            assertTrue(validator.isInitialized(handler.accounts(a)));
        }
    }

    function invariant_theListMatchesWhatTheAccountHolds() public view {
        for (uint256 a; a < 2; ++a) {
            address account = handler.accounts(a);
            (, bytes32[] memory ids, WebAuthnAssertion.Passkey[] memory passkeys) =
                validator.getPasskeys(account);
            uint256 held;
            for (uint256 i; i < 20; ++i) {
                if (!handler.holds(account, i)) continue;
                ++held;
                assertTrue(_contains(ids, handler.passkeyAt(i).id));
            }
            assertEq(held, ids.length);
            for (uint256 i; i < ids.length; ++i) {
                assertEq(ids[i], validator.credentialId(passkeys[i].x, passkeys[i].y));
                for (uint256 j = i + 1; j < ids.length; ++j) {
                    assertNotEq(ids[i], ids[j]);
                }
            }
        }
    }

    function invariant_passkeysOutsideTheAccountNeverSign() public view {
        assertFalse(handler.foreignSignatureAccepted());
    }

    function _contains(bytes32[] memory ids, bytes32 id) internal pure returns (bool) {
        for (uint256 i; i < ids.length; ++i) {
            if (ids[i] == id) return true;
        }
        return false;
    }
}
