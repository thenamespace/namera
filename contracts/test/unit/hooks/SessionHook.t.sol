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
    MockProbe,
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
        assertFalse(hook.isModuleType(5));
        assertTrue(hook.supportsInterface(type(IUserOpPolicy).interfaceId));
        assertTrue(hook.supportsInterface(type(IPolicy).interfaceId));
        assertTrue(hook.supportsInterface(0x01ffc9a7));
        assertFalse(hook.supportsInterface(type(IExecutionPolicy).interfaceId));
        assertFalse(hook.supportsInterface(0x00000000));
        assertFalse(hook.supportsInterface(0xffffffff));
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

    /// @dev Regression (internal review, findings 2 and 3): an installed hook can't be switched to another flavour or
    /// Smart Sessions module without an uninstall; reinstalling the same configuration (Kernel rebinding) is fine.
    function test_install_aDifferentReinstallIsRefused() public {
        install(NEXUS);
        vm.startPrank(address(account));
        hook.onInstall(abi.encode(NEXUS, address(smartSession)));
        vm.expectRevert(SessionHook.InvalidInstall.selector);
        hook.onInstall(abi.encode(SAFE7579, address(smartSession)));
        vm.expectRevert(SessionHook.InvalidInstall.selector);
        hook.onInstall(abi.encode(NEXUS, makeAddr("other smart sessions")));
        vm.stopPrank();
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

        address[2] memory others = [address(1), address(type(uint160).max)];
        for (uint256 i; i < others.length; ++i) {
            vm.prank(others[i]);
            vm.expectRevert(
                abi.encodeWithSelector(SessionHook.OnlySmartSession.selector, others[i])
            );
            hook.initializeWithMultiplexer(address(account), id, data);
        }
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

    /// @dev A contract answering the interface probe with anything but one ABI-encoded `true` is no policy.
    function test_initialize_readsAMalformedInterfaceAnswerAsNo() public {
        install(NEXUS);
        bytes32 id = configId();
        bytes4 probe = IPolicy.supportsInterface.selector;
        MockProbe answers = new MockProbe();
        bytes[3] memory data = [abi.encode(true), bytes(""), abi.encode(true, uint256(0))];
        bool[3] memory reverts = [true, false, false];
        for (uint256 i; i < data.length; ++i) {
            answers.respond(probe, reverts[i], data[i]);
            SessionHook.ExecutionPolicyData[] memory list = new SessionHook.ExecutionPolicyData[](1);
            list[0] = SessionHook.ExecutionPolicyData(address(answers), "");
            vm.prank(address(smartSession));
            vm.expectRevert(
                abi.encodeWithSelector(SessionHook.NotExecutionPolicy.selector, address(answers))
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

        initialize(policies(8, MockExecutionPolicy.Mode.Pass));
        assertEq(hook.getExecutionPolicies(address(account), PERMISSION).length, 8);
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
        account.setHook(address(hook));
        assertEq(checkFrom(address(1), configId(), callData), 1);
        assertEq(checkFrom(address(type(uint160).max), configId(), callData), 1);
        assertEq(checkFrom(address(smartSession), configId(), callData), 0);
        // Another session's configuration.
        assertEq(checkFrom(address(smartSession), bytes32(0), callData), 1);
        assertEq(checkFrom(address(smartSession), bytes32(type(uint256).max), callData), 1);
    }

    /// @dev An account answering the binding probe with anything but its exact ABI encoding is not bound.
    function test_check_readsAMalformedBindingAnswerAsUnbound() public {
        MockProbe probed = new MockProbe();
        vm.prank(address(probed));
        hook.onInstall(abi.encode(KERNEL, address(smartSession)));
        bytes4 kernelProbe = bytes4(keccak256("validationConfig(bytes21)"));
        bytes memory callData = tagged(executeSingle(address(target)));

        probed.respond(kernelProbe, false, abi.encode(uint32(1), address(hook)));
        assertEq(checkAccount(address(probed), callData), 0);
        bytes[5] memory data = [
            abi.encode(address(hook)),
            abi.encode(uint32(1), address(hook), uint256(0)),
            abi.encode(uint32(1), address(hook)),
            abi.encode(uint32(1), address(type(uint160).max)),
            abi.encode(uint32(1), address(1))
        ];
        bool[5] memory reverts = [false, false, true, false, false];
        for (uint256 i; i < data.length; ++i) {
            probed.respond(kernelProbe, reverts[i], data[i]);
            assertEq(checkAccount(address(probed), callData), 1);
        }

        vm.startPrank(address(probed));
        hook.onUninstall("");
        hook.onInstall(abi.encode(NEXUS, address(smartSession)));
        vm.stopPrank();
        bytes4 hookProbe = bytes4(keccak256("isModuleInstalled(uint256,address,bytes)"));
        probed.respond(hookProbe, false, abi.encode(true));
        assertEq(checkAccount(address(probed), callData), 0);
        bytes[3] memory answers = [bytes(""), abi.encode(true, uint256(0)), abi.encode(true)];
        bool[3] memory failed = [false, false, true];
        for (uint256 i; i < answers.length; ++i) {
            probed.respond(hookProbe, failed[i], answers[i]);
            assertEq(checkAccount(address(probed), callData), 1);
        }
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

        // Only `executeUserOp` is unwrapped, and only `execute` is an execution: selectors on either side are not.
        bytes memory execute = executeSingle(address(target));
        assertEq(check(abi.encodePacked(bytes4(0x8dd7712e), tagged(execute))), 1);
        assertEq(check(abi.encodePacked(bytes4(0x8dd77130), tagged(execute))), 1);
        bytes memory body = new bytes(execute.length - 4);
        for (uint256 i; i < body.length; ++i) {
            body[i] = execute[i + 4];
        }
        assertEq(check(tagged(abi.encodePacked(bytes4(0xe9ae5c54), body))), 1);
        assertEq(check(tagged(abi.encodePacked(bytes4(0xe9ae5c52), body))), 1);
        // A single execution too short to name its target.
        assertEq(
            check(
                tagged(
                    abi.encodeWithSignature(
                        "execute(bytes32,bytes)",
                        LibERC7579.encodeMode(LibERC7579.CALLTYPE_SINGLE, 0, 0, 0),
                        hex"01"
                    )
                )
            ),
            1
        );
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
        // Addresses on either side of the forbidden ones are allowed.
        assertEq(check(tagged(executeSingle(address(0)))), 0);
        assertEq(check(tagged(executeSingle(address(1)))), 0);
        assertEq(check(tagged(executeSingle(address(type(uint160).max)))), 0);
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
        assertEq(hook.preCheck(address(0), 0, hex"e9ae5c53"), "");
        assertEq(
            hook.preCheck(
                address(0), 0, abi.encodePacked(bytes4(0xe9ae5c54), hook.tag(PERMISSION))
            ),
            ""
        );
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

        // The tag alone, `execute`'s selector leading the permission id, is a tagged `execute`.
        bytes32 permissionId = bytes32(abi.encodePacked(bytes4(0xe9ae5c53), bytes28(0)));
        bytes memory tail = hook.tag(permissionId);
        vm.prank(address(account));
        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.PermissionNotEnabled.selector, permissionId)
        );
        hook.preCheck(address(0), 0, tail);
    }

    /// @dev Smart Sessions answering either view with anything but one ABI-encoded `true` disables the session.
    function test_execution_readsAMalformedSessionAnswerAsDisabled() public {
        MockProbe probe = new MockProbe();
        vm.prank(address(account));
        hook.onInstall(abi.encode(NEXUS, address(probe)));
        bytes memory execData = tagged(executeSingle(address(target)));
        bytes4[2] memory views = [
            bytes4(keccak256("isPermissionEnabled(bytes32,address)")),
            bytes4(keccak256("isUserOpPolicyEnabled(address,bytes32,address)"))
        ];
        bytes[3] memory data = [bytes(""), abi.encode(true, uint256(0)), abi.encode(true)];
        bool[3] memory reverts = [false, false, true];

        for (uint256 v; v < views.length; ++v) {
            for (uint256 i; i < data.length; ++i) {
                probe.respond(views[0], false, abi.encode(true));
                probe.respond(views[1], false, abi.encode(true));
                probe.respond(views[v], reverts[i], data[i]);
                vm.prank(address(account));
                vm.expectRevert(
                    abi.encodeWithSelector(SessionHook.PermissionNotEnabled.selector, PERMISSION)
                );
                hook.preCheck(address(0), 0, execData);
            }
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

        // Contexts hashing on either side of the real one.
        vm.prank(address(account));
        bytes32 real = keccak256(hook.preCheck(address(0), 0, execData));
        bool below;
        bool above;
        for (uint256 salt; !(below && above); ++salt) {
            bytes memory other =
                abi.encode(PERMISSION, new address[](0), new bytes32[](salt), new bytes[](0));
            bool lower = keccak256(other) < real;
            if (lower ? below : above) continue;
            if (lower) below = true;
            else above = true;
            vm.expectRevert(
                abi.encodeWithSelector(SessionHook.InvalidContext.selector, address(account))
            );
            account.runChecks(asHook, execData, other);
        }

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

    /// @dev Installs the hook with `flavour`, uninstalling it first: a different reinstall is refused.
    function install(uint8 flavour) internal {
        vm.startPrank(address(account));
        hook.onUninstall("");
        hook.onInstall(abi.encode(flavour, address(smartSession)));
        vm.stopPrank();
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
        return checkFrom(address(smartSession), configId(), callData);
    }

    function checkFrom(address caller, bytes32 id, bytes memory callData)
        internal
        returns (uint256)
    {
        ERC4337.PackedUserOperation memory op;
        op.sender = address(account);
        op.callData = callData;
        vm.prank(caller);
        return hook.checkUserOpPolicy(id, op);
    }

    function checkAccount(address sender, bytes memory callData) internal returns (uint256) {
        ERC4337.PackedUserOperation memory op;
        op.sender = sender;
        op.callData = callData;
        bytes32 id = hook.configId(sender, PERMISSION);
        vm.prank(address(smartSession));
        return hook.checkUserOpPolicy(id, op);
    }
}
