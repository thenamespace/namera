// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";

import {ArgPolicy} from "src/policies/ArgPolicy.sol";
import {IPolicy} from "src/policies/interfaces/IPolicy.sol";
import {Conditions} from "src/policies/lib/Conditions.sol";

contract ArgPolicyTest is Test {
    ArgPolicy internal policy = new ArgPolicy();
    address internal account = makeAddr("account");
    bytes32 internal constant ID = keccak256("config");

    // transfer(address to, uint256 amount): `to` at offset 0, `amount` at offset 32.
    function _transfer(address to, uint256 amount) internal pure returns (bytes memory) {
        return abi.encodeWithSelector(0xa9059cbb, to, amount);
    }

    function _rule(Conditions.Condition condition, uint256 offset, uint256 ref)
        internal
        pure
        returns (ArgPolicy.Rule memory rule)
    {
        rule.condition = condition;
        rule.offset = offset;
        rule.refs = new bytes32[](1);
        rule.refs[0] = bytes32(ref);
    }

    function _configure(ArgPolicy.Rule[] memory rules) internal {
        policy.initializeWithMultiplexer(account, ID, abi.encode(rules));
    }

    function _check(uint256 value, bytes memory data) internal view returns (uint256) {
        return policy.checkAction(ID, account, address(0), value, data);
    }

    function _one(ArgPolicy.Rule memory rule)
        internal
        pure
        returns (ArgPolicy.Rule[] memory rules)
    {
        rules = new ArgPolicy.Rule[](1);
        rules[0] = rule;
    }

    function test_eachComparisonRejectsItsBoundary() public {
        uint256 limit = 50e6;
        uint8[6] memory conditions = [0, 1, 2, 3, 4, 5]; // Eq, Neq, Lt, Lte, Gt, Gte
        bool[3][6] memory expected = [
            [false, true, false], // Eq: limit-1, limit, limit+1
            [true, false, true], // Neq
            [true, false, false], // Lt
            [true, true, false], // Lte
            [false, false, true], // Gt
            [false, true, true] // Gte
        ];
        for (uint256 i; i < conditions.length; ++i) {
            _configure(_one(_rule(Conditions.Condition(conditions[i]), 32, limit)));
            for (uint256 j; j < 3; ++j) {
                uint256 vd = _check(0, _transfer(address(1), limit - 1 + j));
                assertEq(
                    vd == 0,
                    expected[i][j],
                    string.concat("condition ", vm.toString(i), " case ", vm.toString(j))
                );
            }
        }
    }

    function test_betweenAndOneOf() public {
        ArgPolicy.Rule memory between = _rule(Conditions.Condition.Between, 32, 10);
        between.refs = new bytes32[](2);
        between.refs[0] = bytes32(uint256(10));
        between.refs[1] = bytes32(uint256(20));
        _configure(_one(between));
        assertEq(_check(0, _transfer(address(1), 10)), 0);
        assertEq(_check(0, _transfer(address(1), 20)), 0);
        assertEq(_check(0, _transfer(address(1), 9)), 1);
        assertEq(_check(0, _transfer(address(1), 21)), 1);

        ArgPolicy.Rule memory oneOf = _rule(Conditions.Condition.OneOf, 0, 0);
        oneOf.refs = new bytes32[](2);
        oneOf.refs[0] = bytes32(uint256(uint160(address(1))));
        oneOf.refs[1] = bytes32(uint256(uint160(address(2))));
        _configure(_one(oneOf));
        assertEq(_check(0, _transfer(address(2), 1)), 0);
        assertEq(_check(0, _transfer(address(3), 1)), 1);
    }

    function test_everyRuleMustHoldIncludingTheValue() public {
        ArgPolicy.Rule[] memory rules = new ArgPolicy.Rule[](2);
        rules[0] = _rule(Conditions.Condition.Eq, 0, uint160(address(1)));
        rules[1] = _rule(Conditions.Condition.Lte, policy.VALUE(), 1 ether);
        _configure(rules);
        assertEq(_check(1 ether, _transfer(address(1), 0)), 0);
        assertEq(_check(1 ether + 1, _transfer(address(1), 0)), 1);
        assertEq(_check(0, _transfer(address(2), 0)), 1);
    }

    function test_calldataTooShortForARuleFailsIt() public {
        _configure(_one(_rule(Conditions.Condition.Lte, 32, type(uint256).max)));
        assertEq(_check(0, abi.encodeWithSelector(0xa9059cbb, address(1))), 1);
    }

    function test_rejectsRulesWithoutTheirReferences() public {
        ArgPolicy.Rule memory missing = _rule(Conditions.Condition.Eq, 0, 0);
        missing.refs = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        _configure(_one(missing));

        ArgPolicy.Rule memory reversed = _rule(Conditions.Condition.Between, 0, 0);
        reversed.refs = new bytes32[](2);
        reversed.refs[0] = bytes32(uint256(2));
        reversed.refs[1] = bytes32(uint256(1));
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        _configure(_one(reversed));

        ArgPolicy.Rule memory emptyList = _rule(Conditions.Condition.OneOf, 0, 0);
        emptyList.refs = new bytes32[](0);
        vm.expectRevert(abi.encodeWithSelector(ArgPolicy.InvalidRule.selector, 0));
        _configure(_one(emptyList));
    }

    function test_failsForAnAccountItWasNotConfiguredFor() public {
        _configure(new ArgPolicy.Rule[](0));
        vm.expectRevert(
            abi.encodeWithSelector(
                IPolicy.PolicyNotInitialized.selector, ID, address(this), address(9)
            )
        );
        policy.checkAction(ID, address(9), address(0), 0, "");
    }

    function test_reportsActionPolicySupport() public view {
        assertTrue(policy.supportsInterface(0x05c00895)); // IActionPolicy
        assertTrue(policy.supportsInterface(0x01ffc9a7));
        assertFalse(policy.supportsInterface(0xffffffff));
    }
}
