// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {SignaturePolicy} from "src/policies/SignaturePolicy.sol";
import {Conditions} from "src/policies/lib/Conditions.sol";
import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";

import {ERC7739Signer} from "../../utils/ERC7739Signer.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {SmartSessionTestBase} from "../../utils/SmartSessionTestBase.sol";

/// @notice A session key signing ERC-2612 permits through Smart Sessions and the account, as the token checks them:
/// `SignaturePolicy` lets it permit one spender up to a cap on one token, and nothing else.
contract SignaturePolicyIntegrationTest is SmartSessionTestBase {
    using SessionBuilder for Session;

    bytes4 internal constant INVALID = 0xffffffff;
    string internal constant PERMIT =
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)";
    bytes32 internal constant USDC_DOMAIN = keccak256("usdc domain separator");

    SignaturePolicy internal signaturePolicy;
    address internal usdc = makeAddr("usdc");
    address internal spender = makeAddr("spender");
    PermissionId internal permissionId;

    function setUp() public override {
        super.setUp();
        signaturePolicy = new SignaturePolicy();

        SignaturePolicy.FieldRule[] memory rules = new SignaturePolicy.FieldRule[](2);
        rules[0] = _rule(Conditions.Condition.Eq, 1, bytes32(uint256(uint160(spender))));
        rules[1] = _rule(Conditions.Condition.Lte, 2, bytes32(uint256(100e6)));
        bytes[] memory types = new bytes[](1);
        types[0] =
            abi.encode(SignaturePolicy.TypedData(USDC_DOMAIN, keccak256(bytes(PERMIT)), rules));
        address[] memory verifiers = new address[](1);
        verifiers[0] = usdc;

        permissionId = enableSession(
            defaultSession()
                .withERC7739Content(USDC_DOMAIN, PERMIT)
                .withERC1271Policy(
                    address(signaturePolicy), abi.encode(SignaturePolicy.Config(verifiers, types))
                )
        );
    }

    function test_permitsTheSpenderUpToTheCap() public {
        assertEq(_tokenChecks(_permit(spender, 100e6)), EIP1271_MAGIC);
        assertEq(_tokenChecks(_permit(spender, 100e6 + 1)), INVALID);
        assertEq(_tokenChecks(_permit(makeAddr("attacker"), 1)), INVALID);
    }

    function test_onlyTheListedTokenMayAcceptIt() public {
        ERC7739Signer.AppData memory permit = _permit(spender, 1);
        bytes memory signature = _sign(permit);

        vm.prank(makeAddr("other token"));
        assertEq(
            account.isValidSignature(
                ERC7739Signer.appHash(permit), abi.encodePacked(address(smartSession), signature)
            ),
            INVALID
        );
    }

    /// @dev Field rules need the typed data: a signature without it is refused, so leaving it out can't skip them.
    function test_aSignatureWithoutTheTypedData_isRefused() public {
        ERC7739Signer.AppData memory permit = _permit(spender, 1);
        bytes memory signature =
            ERC7739Signer.sign(permit, address(account), permissionId, sessionKey, "", "");

        vm.prank(usdc);
        assertEq(
            account.isValidSignature(
                ERC7739Signer.appHash(permit), abi.encodePacked(address(smartSession), signature)
            ),
            INVALID
        );
    }

    function _tokenChecks(ERC7739Signer.AppData memory permit) internal returns (bytes4) {
        bytes memory signature = _sign(permit);
        vm.prank(usdc);
        return account.isValidSignature(
            ERC7739Signer.appHash(permit), abi.encodePacked(address(smartSession), signature)
        );
    }

    function _sign(ERC7739Signer.AppData memory permit) internal view returns (bytes memory) {
        return ERC7739Signer.sign(permit, address(account), permissionId, sessionKey);
    }

    function _permit(address permitSpender, uint256 value)
        internal
        view
        returns (ERC7739Signer.AppData memory)
    {
        return ERC7739Signer.typedData(
            USDC_DOMAIN,
            PERMIT,
            "Permit",
            abi.encode(
                keccak256(bytes(PERMIT)),
                address(account),
                permitSpender,
                value,
                0,
                block.timestamp + 1 hours
            )
        );
    }

    function _rule(Conditions.Condition condition, uint256 index, bytes32 ref)
        internal
        pure
        returns (SignaturePolicy.FieldRule memory rule)
    {
        rule.condition = condition;
        rule.index = index;
        rule.refs = new bytes32[](1);
        rule.refs[0] = ref;
    }
}
