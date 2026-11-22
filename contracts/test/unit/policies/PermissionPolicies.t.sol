// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {AllowPolicy} from "src/policies/AllowPolicy.sol";
import {ApprovalPolicy} from "src/policies/ApprovalPolicy.sol";
import {SignaturePolicy} from "src/policies/SignaturePolicy.sol";
import {
    I1271Policy,
    I1271TypedDataPolicy,
    IActionPolicy,
    IPolicy,
    IUserOpPolicy
} from "src/policies/interfaces/IPolicy.sol";
import {Conditions} from "src/policies/lib/Conditions.sol";

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
    address internal spender = makeAddr("spender");
    bytes32 internal constant ID = keccak256("config");
    bytes32 internal constant USDC_DOMAIN = keccak256("usdc domain");
    bytes32 internal constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    function test_reportsBothERC1271Interfaces() public view {
        assertTrue(policy.supportsInterface(type(I1271Policy).interfaceId));
        assertTrue(policy.supportsInterface(type(I1271TypedDataPolicy).interfaceId));
        assertFalse(policy.supportsInterface(type(IActionPolicy).interfaceId));
    }

    function test_withoutTypes_acceptsOnlyListedVerifyingContracts() public {
        policy.initializeWithMultiplexer(account, ID, _config(new bytes[](0)));

        assertTrue(policy.check1271SignedAction(ID, usdc, account, bytes32(0), ""));
        assertFalse(policy.check1271SignedAction(ID, makeAddr("other"), account, bytes32(0), ""));
        assertTrue(policy.check1271TypedData(ID, usdc, account, USDC_DOMAIN, "", ""));
        assertFalse(policy.check1271TypedData(ID, makeAddr("other"), account, USDC_DOMAIN, "", ""));
    }

    function test_permitRules_bindTheSpenderAndCapTheValue() public {
        policy.initializeWithMultiplexer(account, ID, _permitConfig(100));

        assertTrue(_check(USDC_DOMAIN, _permit(spender, 100)));
        assertTrue(_check(USDC_DOMAIN, _permit(spender, 0)));
        assertFalse(_check(USDC_DOMAIN, _permit(spender, 101)));
        assertFalse(_check(USDC_DOMAIN, _permit(makeAddr("attacker"), 1)));
    }

    function test_permitRules_needTheDomainTypeAndVerifier() public {
        policy.initializeWithMultiplexer(account, ID, _permitConfig(100));
        bytes memory permit = _permit(spender, 1);

        assertFalse(_check(keccak256("other domain"), permit));
        assertFalse(
            policy.check1271TypedData(ID, makeAddr("other"), account, USDC_DOMAIN, permit, "")
        );
        bytes memory otherType = abi.encode(keccak256("Mail(address to)"), spender);
        assertFalse(_check(USDC_DOMAIN, otherType));
    }

    function test_permitRules_failWithoutTheTypedData() public {
        policy.initializeWithMultiplexer(account, ID, _permitConfig(100));
        bytes memory permit = _permit(spender, 1);

        assertFalse(_check(USDC_DOMAIN, ""));
        assertFalse(_check(USDC_DOMAIN, abi.encodePacked(PERMIT_TYPEHASH)));
        // Truncated before the value field (index 2): the rule on it fails.
        assertFalse(_check(USDC_DOMAIN, _truncate(permit, 32 * 3)));
        // A multiplexer without typed data can't satisfy field rules.
        assertFalse(policy.check1271SignedAction(ID, usdc, account, bytes32(0), ""));
    }

    function test_anyListedTypeMayMatch() public {
        bytes[] memory types = new bytes[](2);
        types[0] = abi.encode(
            SignaturePolicy.TypedData(keccak256("chain A"), PERMIT_TYPEHASH, _spenderRule())
        );
        types[1] =
            abi.encode(SignaturePolicy.TypedData(USDC_DOMAIN, PERMIT_TYPEHASH, _spenderRule()));
        policy.initializeWithMultiplexer(account, ID, _config(types));

        assertTrue(_check(keccak256("chain A"), _permit(spender, 5)));
        assertTrue(_check(USDC_DOMAIN, _permit(spender, 5)));
        assertFalse(_check(keccak256("chain B"), _permit(spender, 5)));
    }

    /// @dev A dynamic field's word is its hash, so `Eq` on it pins the exact value.
    function test_dynamicFieldsCompareByHash() public {
        bytes32 typeHash = keccak256("Order(string market,uint256 size)");
        SignaturePolicy.FieldRule[] memory rules = new SignaturePolicy.FieldRule[](1);
        rules[0] = _rule(Conditions.Condition.Eq, 0, keccak256("ETH-USD"));
        bytes[] memory types = new bytes[](1);
        types[0] = abi.encode(SignaturePolicy.TypedData(USDC_DOMAIN, typeHash, rules));
        policy.initializeWithMultiplexer(account, ID, _config(types));

        assertTrue(_check(USDC_DOMAIN, abi.encode(typeHash, keccak256("ETH-USD"), 1)));
        assertFalse(_check(USDC_DOMAIN, abi.encode(typeHash, keccak256("BTC-USD"), 1)));
    }

    function test_rejectsConfigurationsItCannotEnforce() public {
        vm.expectRevert(SignaturePolicy.NoVerifiers.selector);
        policy.initializeWithMultiplexer(
            account, ID, abi.encode(SignaturePolicy.Config(new address[](0), new bytes[](0)))
        );

        SignaturePolicy.FieldRule[] memory rules = new SignaturePolicy.FieldRule[](1);
        rules[0] = _rule(Conditions.Condition.Between, 0, bytes32(0));
        _expectInvalidRule(rules);

        rules[0] = _rule(Conditions.Condition.Eq, uint256(type(uint32).max) + 1, bytes32(0));
        _expectInvalidRule(rules);
    }

    /// @dev The domain and type hash must be equal: neither a smaller nor a larger value passes.
    function test_permitRules_needTheExactDomainAndTypeHash() public {
        policy.initializeWithMultiplexer(account, ID, _permitConfig(100));
        bytes memory permit = _permit(spender, 1);

        assertFalse(_check(bytes32(0), permit));
        assertFalse(_check(bytes32(type(uint256).max), permit));
        assertFalse(_check(USDC_DOMAIN, abi.encode(bytes32(0), account, spender, 1)));
        assertFalse(
            _check(USDC_DOMAIN, abi.encode(bytes32(type(uint256).max), account, spender, 1))
        );
    }

    /// @dev A rule on the last field reads exactly to the end, and a type without rules needs only its type hash.
    function test_fieldRules_readUpToTheLastByte() public {
        policy.initializeWithMultiplexer(account, ID, _permitConfig(100));
        assertTrue(_check(USDC_DOMAIN, abi.encode(PERMIT_TYPEHASH, account, spender, 1)));

        bytes[] memory types = new bytes[](1);
        types[0] = abi.encode(
            SignaturePolicy.TypedData(
                USDC_DOMAIN, PERMIT_TYPEHASH, new SignaturePolicy.FieldRule[](0)
            )
        );
        policy.initializeWithMultiplexer(account, ID, _config(types));
        assertTrue(_check(USDC_DOMAIN, abi.encodePacked(PERMIT_TYPEHASH)));
    }

    function test_withTypes_theHashOnlyHookRefusesEveryone() public {
        policy.initializeWithMultiplexer(account, ID, _permitConfig(100));

        assertFalse(policy.check1271SignedAction(ID, usdc, account, bytes32(0), ""));
        assertFalse(policy.check1271SignedAction(ID, makeAddr("other"), account, bytes32(0), ""));
    }

    function test_acceptsTheLargestFieldIndex() public {
        SignaturePolicy.FieldRule[] memory rules = new SignaturePolicy.FieldRule[](1);
        rules[0] = _rule(Conditions.Condition.Eq, type(uint32).max, bytes32(0));
        bytes[] memory types = new bytes[](1);
        types[0] = abi.encode(SignaturePolicy.TypedData(USDC_DOMAIN, PERMIT_TYPEHASH, rules));
        policy.initializeWithMultiplexer(account, ID, _config(types));

        assertFalse(_check(USDC_DOMAIN, _permit(spender, 1)));
    }

    function test_rejectsARuleThatIsBothOutOfRangeAndMalformed() public {
        SignaturePolicy.FieldRule[] memory rules = new SignaturePolicy.FieldRule[](1);
        rules[0] = _rule(Conditions.Condition.Between, uint256(type(uint32).max) + 1, bytes32(0));
        _expectInvalidRule(rules);
    }

    function _expectInvalidRule(SignaturePolicy.FieldRule[] memory rules) internal {
        bytes[] memory types = new bytes[](1);
        types[0] = abi.encode(SignaturePolicy.TypedData(USDC_DOMAIN, PERMIT_TYPEHASH, rules));
        vm.expectRevert(abi.encodeWithSelector(SignaturePolicy.InvalidFieldRule.selector, 0, 0));
        policy.initializeWithMultiplexer(account, ID, _config(types));
    }

    function _check(bytes32 domain, bytes memory contentsData) internal view returns (bool) {
        return policy.check1271TypedData(ID, usdc, account, domain, contentsData, "");
    }

    function _config(bytes[] memory types) internal view returns (bytes memory) {
        address[] memory verifiers = new address[](1);
        verifiers[0] = usdc;
        return abi.encode(SignaturePolicy.Config(verifiers, types));
    }

    /// @dev Permits on USDC for `spender` only, of at most `maxValue`.
    function _permitConfig(uint256 maxValue) internal view returns (bytes memory) {
        SignaturePolicy.FieldRule[] memory rules = new SignaturePolicy.FieldRule[](2);
        rules[0] = _spenderRule()[0];
        rules[1] = _rule(Conditions.Condition.Lte, 2, bytes32(maxValue));
        bytes[] memory types = new bytes[](1);
        types[0] = abi.encode(SignaturePolicy.TypedData(USDC_DOMAIN, PERMIT_TYPEHASH, rules));
        return _config(types);
    }

    function _spenderRule() internal view returns (SignaturePolicy.FieldRule[] memory rules) {
        rules = new SignaturePolicy.FieldRule[](1);
        rules[0] = _rule(Conditions.Condition.Eq, 1, bytes32(uint256(uint160(spender))));
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

    function _permit(address permitSpender, uint256 value) internal view returns (bytes memory) {
        return abi.encode(PERMIT_TYPEHASH, account, permitSpender, value, 0, type(uint256).max);
    }

    function _truncate(bytes memory data, uint256 length) internal pure returns (bytes memory out) {
        out = new bytes(length);
        for (uint256 i; i < length; ++i) {
            out[i] = data[i];
        }
    }
}
