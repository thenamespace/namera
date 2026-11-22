// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {AllowPolicy} from "src/policies/AllowPolicy.sol";
import {ApprovalPolicy} from "src/policies/ApprovalPolicy.sol";
import {SignaturePolicy} from "src/policies/SignaturePolicy.sol";
import {
    I1271Policy,
    IActionPolicy,
    IPolicy,
    IUserOpPolicy
} from "src/policies/interfaces/IPolicy.sol";

import {PolicyCalls} from "../../utils/PolicyCalls.sol";

contract AllowPolicyTest is Test {
    AllowPolicy internal policy = new AllowPolicy();
    address internal account = makeAddr("account");
    bytes32 internal constant ID = keccak256("config");

    function test_allowsConfiguredActionsAndUserOperations() public {
        policy.initializeWithMultiplexer(account, ID, "");
        assertEq(policy.checkAction(ID, account, address(1), 1 ether, hex"12345678"), 0);
        assertEq(policy.checkUserOpPolicy(ID, PolicyCalls.op(account, "")), 0);
    }

    function test_failsWhereItWasNotConfigured() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IPolicy.PolicyNotInitialized.selector, ID, address(this), account
            )
        );
        policy.checkAction(ID, account, address(1), 0, "");
    }

    function test_isAnActionAndUserOperationPolicyButNeverAnErc1271One() public view {
        assertTrue(policy.supportsInterface(type(IActionPolicy).interfaceId));
        assertTrue(policy.supportsInterface(type(IUserOpPolicy).interfaceId));
        assertFalse(policy.supportsInterface(type(I1271Policy).interfaceId));
    }
}

contract ApprovalPolicyTest is Test {
    ApprovalPolicy internal policy = new ApprovalPolicy();
    address internal account = makeAddr("account");
    address internal permit2 = makeAddr("permit2");
    address internal spender = makeAddr("spender");
    address internal token = makeAddr("token");
    bytes32 internal constant ID = keccak256("config");

    function setUp() public {
        address[] memory spenders = new address[](1);
        spenders[0] = spender;
        address[] memory tokens = new address[](1);
        tokens[0] = token;
        policy.initializeWithMultiplexer(account, ID, abi.encode(spenders, uint256(100), tokens));
    }

    function _check(address target, bytes memory data) internal view returns (uint256) {
        return policy.checkAction(ID, account, target, 0, data);
    }

    function test_allowsListedSpendersUpToTheMaximum() public {
        assertEq(_check(token, PolicyCalls.approve(spender, 100)), 0);
        assertEq(_check(token, PolicyCalls.approve(spender, 101)), 1);
        assertEq(_check(token, PolicyCalls.approve(makeAddr("other"), 1)), 1);
        assertEq(_check(token, abi.encodeWithSelector(0x39509351, spender, 100)), 0);
        assertEq(_check(token, abi.encodeWithSelector(0x39509351, spender, 101)), 1);
    }

    function test_alwaysAllowsRevoking() public {
        assertEq(_check(token, PolicyCalls.approve(makeAddr("anyone"), 0)), 0);
    }

    function test_checksPermit2ApprovalsAgainstTheTokenList() public {
        bytes4 permit2Approve = 0x87517c45;
        assertEq(
            _check(
                permit2,
                abi.encodeWithSelector(permit2Approve, token, spender, uint160(100), uint48(1))
            ),
            0
        );
        assertEq(
            _check(
                permit2,
                abi.encodeWithSelector(
                    permit2Approve, makeAddr("x"), spender, uint160(1), uint48(1)
                )
            ),
            1
        );
        assertEq(
            _check(
                permit2,
                abi.encodeWithSelector(permit2Approve, token, spender, uint160(101), uint48(1))
            ),
            1
        );
    }

    function test_failsAnyOtherFunctionOrTruncatedCalldata() public view {
        assertEq(_check(token, PolicyCalls.transfer(spender, 1)), 1);
        assertEq(_check(token, abi.encodeWithSelector(0x095ea7b3, spender)), 1);
        assertEq(_check(token, hex"0950"), 1);
    }
}

contract SignaturePolicyTest is Test {
    SignaturePolicy internal policy = new SignaturePolicy();
    address internal account = makeAddr("account");
    address internal usdc = makeAddr("usdc");
    bytes32 internal constant ID = keccak256("config");

    function test_acceptsOnlyListedVerifyingContracts() public {
        address[] memory verifiers = new address[](1);
        verifiers[0] = usdc;
        policy.initializeWithMultiplexer(account, ID, abi.encode(verifiers));
        assertTrue(policy.check1271SignedAction(ID, usdc, account, bytes32(0), ""));
        assertFalse(policy.check1271SignedAction(ID, makeAddr("other"), account, bytes32(0), ""));
        assertTrue(policy.supportsInterface(type(I1271Policy).interfaceId));
        assertFalse(policy.supportsInterface(type(IActionPolicy).interfaceId));
    }
}
