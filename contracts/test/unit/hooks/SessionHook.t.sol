// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";

import {SessionHook} from "src/hooks/SessionHook.sol";
import {IExecutionPolicy} from "src/hooks/interfaces/IExecutionPolicy.sol";
import {IPolicy, IUserOpPolicy} from "src/policies/interfaces/IPolicy.sol";
import {Execution} from "src/smart-sessions/lib/ExecutionLib.sol";

import {MockExecutionPolicy} from "../../utils/mocks/MockExecutionPolicy.sol";
import {
    IHook,
    MockHookAccount,
    MockSmartSessionViews
} from "../../utils/mocks/MockHookEnvironment.sol";
import {MockTarget} from "../../utils/mocks/MockTarget.sol";

contract SessionHookTest is Test {
    bytes32 internal constant PERMISSION = keccak256("permission");
    uint8 internal constant KERNEL = 1;
    uint8 internal constant NEXUS = 2;
    uint8 internal constant SAFE7579 = 3;

    SessionHook internal hook;
    MockHookAccount internal account;
    MockSmartSessionViews internal smartSession;
    MockExecutionPolicy internal policy;
    MockTarget internal target;

    function setUp() public {
        hook = new SessionHook();
        account = new MockHookAccount();
        smartSession = new MockSmartSessionViews();
        policy = new MockExecutionPolicy();
        target = new MockTarget();
    }

    // --------------------------------------------------------------------------------------------
    // Module
    // --------------------------------------------------------------------------------------------

    function test_module_isAHookAndAUserOpPolicy() public view {
        assertTrue(hook.isModuleType(4));
        assertFalse(hook.isModuleType(1));
        assertTrue(hook.supportsInterface(type(IUserOpPolicy).interfaceId));
        assertTrue(hook.supportsInterface(type(IPolicy).interfaceId));
        assertTrue(hook.supportsInterface(0x01ffc9a7));
        assertFalse(hook.supportsInterface(type(IExecutionPolicy).interfaceId));
    }

    function test_install_recordsFlavourAndSmartSession() public {
        install(NEXUS);
        (SessionHook.Flavour flavour, address installed) = hook.getInstall(address(account));
        assertEq(uint8(flavour), NEXUS);
        assertEq(installed, address(smartSession));
        assertTrue(hook.isInitialized(address(account)));

        vm.prank(address(account));
        hook.onUninstall("");
        assertFalse(hook.isInitialized(address(account)));
    }

    function test_install_rejectsBadData() public {
        uint8[2] memory flavours = [0, 4];
        for (uint256 i; i < flavours.length; ++i) {
            vm.prank(address(account));
            vm.expectRevert(SessionHook.InvalidInstall.selector);
            hook.onInstall(abi.encode(flavours[i], address(smartSession)));
        }
        vm.prank(address(account));
        vm.expectRevert(SessionHook.InvalidInstall.selector);
        hook.onInstall(abi.encode(NEXUS, address(0)));
    }

    // --------------------------------------------------------------------------------------------
    // Policy lists
    // --------------------------------------------------------------------------------------------

    function test_initialize_storesAndInitializesThePolicies() public {
        install(NEXUS);
        initialize(policies(2, MockExecutionPolicy.Mode.RevertPost));

        address[] memory stored = hook.getExecutionPolicies(address(account), PERMISSION);
        assertEq(stored.length, 2);
        assertEq(stored[1], address(policy));
        bytes32 id = hook.policyConfigId(configId(), 1);
        assertEq(
            uint8(policy.modes(id, address(hook), address(account))),
            uint8(MockExecutionPolicy.Mode.RevertPost)
        );
    }

    function test_initialize_onlyFromTheInstalledSmartSession() public {
        bytes32 id = configId();
        bytes memory data = abi.encode(policies(1, MockExecutionPolicy.Mode.Pass));
        vm.prank(address(smartSession));
        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.SessionHookNotInstalled.selector, address(account))
        );
        hook.initializeWithMultiplexer(address(account), id, data);

        install(NEXUS);
        vm.prank(makeAddr("another multiplexer"));
        vm.expectRevert(
            abi.encodeWithSelector(
                SessionHook.OnlySmartSession.selector, makeAddr("another multiplexer")
            )
        );
        hook.initializeWithMultiplexer(address(account), id, data);
    }

    function test_initialize_rejectsWhatIsNotAnExecutionPolicy() public {
        install(NEXUS);
        bytes32 id = configId();
        address[2] memory notPolicies = [address(target), makeAddr("no code")];
        for (uint256 i; i < notPolicies.length; ++i) {
            SessionHook.ExecutionPolicyData[] memory list = new SessionHook.ExecutionPolicyData[](1);
            list[0] = SessionHook.ExecutionPolicyData(notPolicies[i], "");
            vm.prank(address(smartSession));
            vm.expectRevert(
                abi.encodeWithSelector(SessionHook.NotExecutionPolicy.selector, notPolicies[i])
            );
            hook.initializeWithMultiplexer(address(account), id, abi.encode(list));
        }
    }

    function test_initialize_capsThePolicies() public {
        install(NEXUS);
        bytes32 id = configId();
        bytes memory data = abi.encode(policies(9, MockExecutionPolicy.Mode.Pass));
        vm.prank(address(smartSession));
        vm.expectRevert(abi.encodeWithSelector(SessionHook.TooManyExecutionPolicies.selector, 9));
        hook.initializeWithMultiplexer(address(account), id, data);
    }

    /// @dev Initialization runs during validation in enable mode, so it may write only storage associated with the
    /// account (ERC-7562): every slot is keyed by the account as the innermost mapping key.
    function test_initialize_writesOnlyAccountAssociatedSlots() public {
        install(NEXUS);
        bytes32 id = configId();
        bytes memory data = abi.encode(policies(2, MockExecutionPolicy.Mode.Pass));

        vm.record();
        vm.prank(address(smartSession));
        hook.initializeWithMultiplexer(address(account), id, data);
        (, bytes32[] memory writes) = vm.accesses(address(hook));

        // `_counts` is slot 1, `_policies` slot 2 (after `_installs`).
        bytes32 countSlot =
            keccak256(abi.encode(address(account), keccak256(abi.encode(id, uint256(1)))));
        bytes32[3] memory expected = [
            countSlot,
            keccak256(
                abi.encode(
                    address(account),
                    keccak256(abi.encode(uint256(0), keccak256(abi.encode(id, uint256(2)))))
                )
            ),
            keccak256(
                abi.encode(
                    address(account),
                    keccak256(abi.encode(uint256(1), keccak256(abi.encode(id, uint256(2)))))
                )
            )
        ];
        assertGt(writes.length, 0);
        for (uint256 i; i < writes.length; ++i) {
            bool known =
                writes[i] == expected[0] || writes[i] == expected[1] || writes[i] == expected[2];
            assertTrue(known, "a write outside the account's slots");
        }
        assertEq(uint256(vm.load(address(hook), countSlot)), 2);
    }

    // --------------------------------------------------------------------------------------------
    // Validation
    // --------------------------------------------------------------------------------------------

    function test_check_acceptsATaggedExecuteOnABoundAccount() public {
        install(NEXUS);
        account.setHook(address(hook));
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));

        assertEq(check(tagged(executeSingle(address(target)))), 0);
        // Kernel's `executeUserOp(execute(…))`, bound through `validationConfig`.
        install(KERNEL);
        account.setKernelHook(address(hook));
        assertEq(
            check(abi.encodePacked(bytes4(0x8dd7712f), tagged(executeSingle(address(target))))), 0
        );
    }

    function test_check_rejectsUnboundAccountsAndOtherCallers() public {
        install(NEXUS);
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory callData = tagged(executeSingle(address(target)));
        assertEq(check(callData), 1);

        account.setHook(address(hook));
        install(KERNEL);
        assertEq(check(callData), 1);

        install(NEXUS);
        ERC4337.PackedUserOperation memory op;
        op.sender = address(account);
        op.callData = callData;
        // Not from the installed Smart Sessions module.
        assertEq(hook.checkUserOpPolicy(configId(), op), 1);
    }

    function test_check_rejectsMissingOrForeignTags() public {
        install(SAFE7579);
        account.setHook(address(hook));
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory execute = executeSingle(address(target));

        assertEq(check(execute), 1);
        assertEq(check(abi.encodePacked(execute, hook.tag(keccak256("other")))), 1);
        assertEq(check(abi.encodePacked(execute, PERMISSION, keccak256("not the tag"))), 1);
        assertEq(check(hook.tag(PERMISSION)), 1);
    }

    function test_check_requiresAPlainExecute() public {
        install(NEXUS);
        account.setHook(address(hook));
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));

        // Another account function, an `executeUserOp` wrapping one, a delegatecall, and `executeUserOp` alone.
        assertEq(
            check(
                tagged(
                    abi.encodeWithSignature(
                        "installModule(uint256,address,bytes)", 4, address(0), ""
                    )
                )
            ),
            1
        );
        assertEq(
            check(
                abi.encodePacked(
                    bytes4(0x8dd7712f),
                    tagged(abi.encodeWithSignature("upgradeTo(address)", address(0)))
                )
            ),
            1
        );
        bytes32 delegate = LibERC7579.encodeMode(LibERC7579.CALLTYPE_DELEGATECALL, 0, 0, 0);
        assertEq(
            check(
                tagged(
                    abi.encodeWithSignature(
                        "execute(bytes32,bytes)", delegate, abi.encodePacked(address(target))
                    )
                )
            ),
            1
        );
        assertEq(check(tagged(abi.encodePacked(bytes4(0x8dd7712f)))), 1);
    }

    function test_check_rejectsCallsToTheHookTheAccountOrAPolicy() public {
        install(NEXUS);
        account.setHook(address(hook));
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));

        address[3] memory forbidden = [address(hook), address(account), address(policy)];
        for (uint256 i; i < forbidden.length; ++i) {
            assertEq(check(tagged(executeSingle(forbidden[i]))), 1);
            Execution[] memory batch = new Execution[](2);
            batch[0] = Execution(address(target), 0, "");
            batch[1] = Execution(forbidden[i], 0, "");
            assertEq(check(tagged(executeBatch(batch))), 1);
        }
        Execution[] memory allowed = new Execution[](1);
        allowed[0] = Execution(address(target), 0, "");
        assertEq(check(tagged(executeBatch(allowed))), 0);
    }

    // --------------------------------------------------------------------------------------------
    // Execution
    // --------------------------------------------------------------------------------------------

    function test_execution_runsThePoliciesAroundTheCalls() public {
        install(NEXUS);
        initialize(policies(2, MockExecutionPolicy.Mode.Pass));
        bytes memory execData = tagged(executeSingle(address(target)));

        account.runChecks(IHook(address(hook)), execData, "");
        assertEq(policy.preChecks(address(account)), 2);
        assertEq(policy.postChecks(address(account)), 2);
        assertEq(policy.lastExecData(), execData);
    }

    function test_execution_dropsSafe7579sAppendedSender() public {
        install(SAFE7579);
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory execData = tagged(executeSingle(address(target)));

        vm.prank(address(account));
        hook.preCheck(address(0), 0, abi.encodePacked(execData, makeAddr("entry point")));
        assertEq(policy.lastExecData(), execData);

        vm.prank(address(account));
        assertEq(hook.preCheck(address(0), 0, hex"0102"), "");
    }

    function test_execution_passesThroughWhatIsNotATaggedExecute() public {
        install(NEXUS);
        initialize(policies(1, MockExecutionPolicy.Mode.RevertPre));

        vm.startPrank(address(account));
        assertEq(hook.preCheck(address(0), 0, executeSingle(address(target))), "");
        assertEq(
            hook.preCheck(
                address(0),
                0,
                abi.encodePacked(bytes4(0x8dd7712f), tagged(executeSingle(address(target))))
            ),
            ""
        );
        assertEq(hook.preCheck(address(0), 0, hex"e9ae"), "");
        hook.postCheck("");
        vm.stopPrank();

        // Not installed: nothing runs.
        vm.prank(makeAddr("other account"));
        assertEq(hook.preCheck(address(0), 0, tagged(executeSingle(address(target)))), "");
    }

    function test_execution_requiresTheSessionToStillUseTheHook() public {
        install(NEXUS);
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory execData = tagged(executeSingle(address(target)));

        bool[2][2] memory states = [[false, true], [true, false]];
        for (uint256 i; i < states.length; ++i) {
            smartSession.set(states[i][0], states[i][1]);
            vm.prank(address(account));
            vm.expectRevert(
                abi.encodeWithSelector(SessionHook.PermissionNotEnabled.selector, PERMISSION)
            );
            hook.preCheck(address(0), 0, execData);
        }
    }

    function test_execution_wrapsAPolicyFailure() public {
        install(NEXUS);
        initialize(policies(1, MockExecutionPolicy.Mode.RevertPre));
        bytes32 id = hook.policyConfigId(configId(), 0);
        bytes memory execData = tagged(executeSingle(address(target)));

        vm.prank(address(account));
        vm.expectRevert(
            abi.encodeWithSelector(
                SessionHook.ExecutionPolicyViolation.selector,
                PERMISSION,
                address(policy),
                abi.encodeWithSelector(MockExecutionPolicy.Rejected.selector, id, address(account))
            )
        );
        hook.preCheck(address(0), 0, execData);
    }

    function test_execution_locksAndChecksTheContext() public {
        install(NEXUS);
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory execData = tagged(executeSingle(address(target)));
        IHook asHook = IHook(address(hook));

        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.ReentrantCheck.selector, address(account))
        );
        account.preCheckTwice(asHook, execData);

        bytes memory forged =
            abi.encode(PERMISSION, new address[](0), new bytes32[](0), new bytes[](0));
        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.InvalidContext.selector, address(account))
        );
        account.runChecks(asHook, execData, forged);

        // Consumed: the same context can't be replayed.
        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.InvalidContext.selector, address(account))
        );
        account.replayContext(asHook, execData);

        // Without a running check, a context is rejected too.
        vm.prank(address(account));
        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.InvalidContext.selector, address(account))
        );
        hook.postCheck(forged);
    }

    function test_views_tagAndConfigIds() public view {
        assertEq(
            hook.tag(PERMISSION), abi.encodePacked(PERMISSION, keccak256("namera.session-hook.tag"))
        );
        assertEq(
            hook.configId(address(account), PERMISSION),
            keccak256(abi.encodePacked(address(account), PERMISSION))
        );
        assertEq(hook.policyConfigId(PERMISSION, 3), keccak256(abi.encode(PERMISSION, uint256(3))));
        assertEq(hook.TAG(), keccak256("namera.session-hook.tag"));
    }

    // --------------------------------------------------------------------------------------------
    // IExecutionPolicy and ExecutionPolicyBase
    // --------------------------------------------------------------------------------------------

    /// @dev The interface applications implement: a change to it changes this id.
    function test_interface_idIsPinned() public pure {
        assertEq(
            type(IExecutionPolicy).interfaceId,
            bytes4(keccak256("preCheck(bytes32,address,bytes)"))
                ^ bytes4(keccak256("postCheck(bytes32,address,bytes)"))
        );
    }

    function test_policyBase_reportsItsInterfacesAndKeysByMultiplexer() public {
        assertTrue(policy.supportsInterface(type(IExecutionPolicy).interfaceId));
        assertTrue(policy.supportsInterface(type(IPolicy).interfaceId));
        assertTrue(policy.supportsInterface(0x01ffc9a7));
        assertFalse(policy.supportsInterface(type(IUserOpPolicy).interfaceId));

        vm.expectEmit(address(policy));
        emit IPolicy.PolicySet(PERMISSION, address(this), address(account));
        policy.initializeWithMultiplexer(
            address(account), PERMISSION, abi.encode(MockExecutionPolicy.Mode.RevertPre)
        );
        assertEq(
            uint8(policy.modes(PERMISSION, address(this), address(account))),
            uint8(MockExecutionPolicy.Mode.RevertPre)
        );
        // Another multiplexer's configuration of the same id is separate.
        assertEq(
            uint8(policy.modes(PERMISSION, address(hook), address(account))),
            uint8(MockExecutionPolicy.Mode.Pass)
        );
    }

    // --------------------------------------------------------------------------------------------
    // Helpers
    // --------------------------------------------------------------------------------------------

    function install(uint8 flavour) internal {
        vm.prank(address(account));
        hook.onInstall(abi.encode(flavour, address(smartSession)));
    }

    function configId() internal view returns (bytes32) {
        return hook.configId(address(account), PERMISSION);
    }

    function policies(uint256 count, MockExecutionPolicy.Mode mode)
        internal
        view
        returns (SessionHook.ExecutionPolicyData[] memory list)
    {
        list = new SessionHook.ExecutionPolicyData[](count);
        for (uint256 i; i < count; ++i) {
            list[i] = SessionHook.ExecutionPolicyData(address(policy), abi.encode(mode));
        }
    }

    function initialize(SessionHook.ExecutionPolicyData[] memory list) internal {
        bytes32 id = configId();
        vm.prank(address(smartSession));
        hook.initializeWithMultiplexer(address(account), id, abi.encode(list));
    }

    function tagged(bytes memory callData) internal view returns (bytes memory) {
        return abi.encodePacked(callData, hook.tag(PERMISSION));
    }

    function executeSingle(address to) internal pure returns (bytes memory) {
        bytes32 mode = LibERC7579.encodeMode(LibERC7579.CALLTYPE_SINGLE, 0, 0, 0);
        return abi.encodeWithSignature(
            "execute(bytes32,bytes)", mode, abi.encodePacked(to, uint256(0), hex"")
        );
    }

    function executeBatch(Execution[] memory batch) internal pure returns (bytes memory) {
        bytes32 mode = LibERC7579.encodeMode(LibERC7579.CALLTYPE_BATCH, 0, 0, 0);
        return abi.encodeWithSignature("execute(bytes32,bytes)", mode, abi.encode(batch));
    }

    function check(bytes memory callData) internal returns (uint256) {
        ERC4337.PackedUserOperation memory op;
        op.sender = address(account);
        op.callData = callData;
        bytes32 id = configId();
        vm.prank(address(smartSession));
        return hook.checkUserOpPolicy(id, op);
    }
}
