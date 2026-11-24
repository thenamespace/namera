// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";

import {SessionHook} from "src/hooks/SessionHook.sol";
import {IExecutionPolicy} from "src/hooks/interfaces/IExecutionPolicy.sol";
import {IPolicy, IUserOpPolicy} from "src/policies/interfaces/IPolicy.sol";
import {UserOpCalls} from "src/policies/lib/UserOpCalls.sol";
import {Execution} from "src/smart-sessions/lib/ExecutionLib.sol";
import {SupportedAccount} from "src/smart-sessions/lib/SupportedAccount.sol";

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
        account.bind(address(hook));
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

    function test_install_recordsTheSmartSession() public {
        vm.expectEmit(address(hook));
        emit SessionHook.SessionHookInstalled(address(account), address(smartSession));
        install();
        assertEq(hook.getSmartSession(address(account)), address(smartSession));
        assertTrue(hook.isInitialized(address(account)));

        vm.prank(address(account));
        hook.onUninstall("");
        assertEq(hook.getSmartSession(address(account)), address(0));
        assertFalse(hook.isInitialized(address(account)));
    }

    function test_install_rejectsAZeroSmartSession() public {
        vm.prank(address(account));
        vm.expectRevert(SessionHook.InvalidInstall.selector);
        hook.onInstall(abi.encode(address(0)));
    }

    /// @dev Regression (internal review, findings 2 and 3): an installed hook can't be switched to another Smart
    /// Sessions module without an uninstall; reinstalling the same module (Kernel rebinding) is fine.
    function test_install_aDifferentReinstallIsRefused() public {
        install();
        vm.startPrank(address(account));
        hook.onInstall(abi.encode(address(smartSession)));
        vm.expectRevert(SessionHook.InvalidInstall.selector);
        hook.onInstall(abi.encode(makeAddr("other smart sessions")));
        vm.stopPrank();
        assertEq(hook.getSmartSession(address(account)), address(smartSession));
    }

    /// @dev Only Kernel 3.3 installs the hook: another `accountId()`, none, or a failing one is refused.
    function test_install_refusedOnAnAccountThatIsNotKernel3_3() public {
        MockProbe other = new MockProbe();
        bytes4 accountId = bytes4(keccak256("accountId()"));
        bytes memory data = abi.encode(address(smartSession));
        bytes[5] memory answers = [
            abi.encode("kernel.advanced.v0.3.2"),
            abi.encode("example.account.1.0.0"),
            abi.encode(""),
            bytes(""),
            abi.encode("kernel.advanced.v0.3.3")
        ];
        bool[5] memory reverts = [false, false, false, false, true];
        for (uint256 i; i < answers.length; ++i) {
            other.respond(accountId, reverts[i], answers[i]);
            vm.prank(address(other));
            vm.expectRevert(
                abi.encodeWithSelector(SupportedAccount.UnsupportedAccount.selector, address(other))
            );
            hook.onInstall(data);
        }

        address noCode = makeAddr("no code");
        vm.prank(noCode);
        vm.expectRevert(
            abi.encodeWithSelector(SupportedAccount.UnsupportedAccount.selector, noCode)
        );
        hook.onInstall(data);

        other.respond(accountId, false, abi.encode("kernel.advanced.v0.3.3"));
        vm.prank(address(other));
        hook.onInstall(data);
        assertEq(hook.getSmartSession(address(other)), address(smartSession));
    }

    // --------------------------------------------------------------------------------------------
    // Policy lists
    // --------------------------------------------------------------------------------------------

    function test_initialize_storesAndInitializesThePolicies() public {
        install();
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

        install();
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
        install();
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
        install();
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
        install();
        bytes32 id = configId();
        bytes memory data = abi.encode(policies(9, MockExecutionPolicy.Mode.Pass));
        vm.prank(address(smartSession));
        vm.expectRevert(abi.encodeWithSelector(SessionHook.TooManyExecutionPolicies.selector, 9));
        hook.initializeWithMultiplexer(address(account), id, data);

        initialize(policies(8, MockExecutionPolicy.Mode.Pass));
        assertEq(hook.getExecutionPolicies(address(account), PERMISSION).length, 8);
    }

    /// @dev Initialization runs during validation in enable mode, so it may write only storage associated with the
    /// account (ERC-7562): every slot it writes is a mapping entry keyed by the account.
    function test_initialize_writesOnlyAccountAssociatedSlots() public {
        install();
        bytes32 id = configId();
        bytes memory data = abi.encode(policies(2, MockExecutionPolicy.Mode.Pass));

        vm.record();
        vm.startMappingRecording();
        vm.prank(address(smartSession));
        hook.initializeWithMultiplexer(address(account), id, data);
        (, bytes32[] memory writes) = vm.accesses(address(hook));

        assertGt(writes.length, 0);
        for (uint256 i; i < writes.length; ++i) {
            (bool found, bytes32 key,) = vm.getMappingKeyAndParentOf(address(hook), writes[i]);
            assertTrue(found, "a write outside a mapping");
            assertEq(
                key, bytes32(uint256(uint160(address(account)))), "a write not keyed by the account"
            );
        }
        vm.stopMappingRecording();
    }

    // --------------------------------------------------------------------------------------------
    // Validation
    // --------------------------------------------------------------------------------------------

    function test_check_acceptsATaggedExecuteOnABoundAccount() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));

        assertEq(check(tagged(executeSingle(address(target)))), 0);
        // Kernel's `executeUserOp(execute(…))`, which runs the hook.
        assertEq(
            check(abi.encodePacked(bytes4(0x8dd7712f), tagged(executeSingle(address(target))))), 0
        );
    }

    function test_check_rejectsUnboundAccountsAndOtherCallers() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory callData = tagged(executeSingle(address(target)));

        // Kernel binds no hook, or another one, to Smart Sessions' validation.
        account.bind(address(0));
        assertEq(check(callData), 1);
        account.bind(makeAddr("another hook"));
        assertEq(check(callData), 1);
        account.bind(address(hook));

        ERC4337.PackedUserOperation memory op;
        op.sender = address(account);
        op.callData = callData;
        // Not from the installed Smart Sessions module.
        assertEq(hook.checkUserOpPolicy(configId(), op), 1);
        assertEq(checkFrom(address(1), configId(), callData), 1);
        assertEq(checkFrom(address(type(uint160).max), configId(), callData), 1);
        assertEq(checkFrom(address(smartSession), configId(), callData), 0);
        // Another session's configuration.
        assertEq(checkFrom(address(smartSession), bytes32(0), callData), 1);
        assertEq(checkFrom(address(smartSession), bytes32(type(uint256).max), callData), 1);

        // Bound but uninstalled.
        vm.prank(address(account));
        hook.onUninstall("");
        assertEq(check(callData), 1);
    }

    /// @dev An account answering the binding probe with anything but its exact ABI encoding is not bound.
    function test_check_readsAMalformedBindingAnswerAsUnbound() public {
        MockProbe probed = new MockProbe();
        probed.respond(
            bytes4(keccak256("accountId()")), false, abi.encode("kernel.advanced.v0.3.3")
        );
        vm.prank(address(probed));
        hook.onInstall(abi.encode(address(smartSession)));
        bytes4 bindingProbe = bytes4(keccak256("validationConfig(bytes21)"));
        bytes memory callData = tagged(executeSingle(address(target)));

        probed.respond(bindingProbe, false, abi.encode(uint32(1), address(hook)));
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
            probed.respond(bindingProbe, reverts[i], data[i]);
            assertEq(checkAccount(address(probed), callData), 1);
        }
    }

    function test_check_rejectsMissingOrForeignTags() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes memory execute = executeSingle(address(target));

        assertEq(check(execute), 1);
        assertEq(check(abi.encodePacked(execute, hook.tag(keccak256("other")))), 1);
        assertEq(check(abi.encodePacked(execute, PERMISSION, keccak256("not the tag"))), 1);
        assertEq(check(hook.tag(PERMISSION)), 1);
    }

    function test_check_requiresAPlainExecute() public {
        install();
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

    /// @dev Regression (Smart Sessions target): a call to the Smart Sessions module could replace the session's
    /// execution policies while they measure the operation.
    function test_check_rejectsCallsToTheHookTheAccountSmartSessionsTheEntryPointOrAPolicy()
        public
    {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));

        address[5] memory forbidden = [
            address(hook),
            address(account),
            address(smartSession),
            0x0000000071727De22E5E9d8BAf0edAc6f37da032,
            address(policy)
        ];
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
        install();
        initialize(policies(2, MockExecutionPolicy.Mode.Pass));
        bytes memory execData = tagged(executeSingle(address(target)));

        account.runChecks(IHook(address(hook)), execData, "");
        assertEq(policy.preChecks(address(account)), 2);
        assertEq(policy.postChecks(address(account)), 2);
        assertEq(policy.lastExecData(), execData);
    }

    function test_execution_passesThroughWhatIsNotATaggedExecute() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.RevertPre));
        IHook asHook = IHook(address(hook));

        // Not `execute`: no context.
        vm.startPrank(address(account));
        assertEq(
            hook.preCheck(
                address(0),
                0,
                abi.encodePacked(bytes4(0x8dd7712f), tagged(executeSingle(address(target))))
            ),
            ""
        );
        assertEq(hook.preCheck(address(0), 0, hex"e9ae"), "");
        assertEq(
            hook.preCheck(
                address(0), 0, abi.encodePacked(bytes4(0xe9ae5c54), hook.tag(PERMISSION))
            ),
            ""
        );
        hook.postCheck("");
        vm.stopPrank();

        // An untagged `execute` runs no policy (this one would revert).
        account.runChecks(asHook, executeSingle(address(target)), "");
        account.runChecks(asHook, hex"e9ae5c53", "");
        assertEq(policy.preChecks(address(account)), 0);

        // Not installed: nothing runs.
        vm.prank(makeAddr("other account"));
        assertEq(hook.preCheck(address(0), 0, tagged(executeSingle(address(target)))), "");
    }

    /// @dev Regression (internal review, findings 1 to 3): Kernel doesn't report a validator's hook as installed, so
    /// Smart Sessions can't refuse a session's calls to it. The hook holds its lock through every operation it runs
    /// around, untagged ones too, so their calls can't uninstall or reinstall it.
    function test_execution_holdsTheLockThroughTheCalls() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        IHook asHook = IHook(address(hook));
        bytes[2] memory operations =
            [executeSingle(address(target)), tagged(executeSingle(address(target)))];
        bytes[2] memory calls = [
            abi.encodeCall(SessionHook.onUninstall, ("")),
            abi.encodeCall(SessionHook.onInstall, (abi.encode(address(smartSession))))
        ];
        for (uint256 i; i < operations.length; ++i) {
            for (uint256 j; j < calls.length; ++j) {
                vm.expectRevert(
                    abi.encodeWithSelector(SessionHook.ReentrantCheck.selector, address(account))
                );
                account.callDuringCheck(asHook, operations[i], address(hook), calls[j]);
            }
        }
        assertEq(hook.getSmartSession(address(account)), address(smartSession));
    }

    /// @dev Regression (postCheck lock): the lock holds while the execution policies' `postCheck`s run, so none of
    /// them can uninstall the hook or start another check through the account.
    function test_execution_holdsTheLockThroughThePolicyPostChecks() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        IHook asHook = IHook(address(hook));
        bytes memory execData = tagged(executeSingle(address(target)));
        bytes[2] memory reentries = [
            abi.encodeCall(SessionHook.onUninstall, ("")),
            abi.encodeCall(IHook.preCheck, (address(0), 0, executeSingle(address(target))))
        ];
        for (uint256 i; i < reentries.length; ++i) {
            policy.setPostCheckCall(
                abi.encodeCall(MockHookAccount.callHook, (asHook, reentries[i]))
            );
            vm.expectRevert(
                abi.encodeWithSelector(
                    SessionHook.ExecutionPolicyViolation.selector,
                    PERMISSION,
                    address(policy),
                    abi.encodeWithSelector(SessionHook.ReentrantCheck.selector, address(account))
                )
            );
            account.runChecks(asHook, execData, "");
        }

        // Released once the policies are done: the next operation runs.
        policy.setPostCheckCall("");
        account.runChecks(asHook, execData, "");
        assertEq(hook.getSmartSession(address(account)), address(smartSession));
    }

    /// @dev Regression (initialization lock): Smart Sessions can't reinitialize a session's execution policies while
    /// one of the account's operations runs between them.
    function test_initialize_isRefusedDuringAnOperation() public {
        install();
        initialize(policies(1, MockExecutionPolicy.Mode.Pass));
        bytes32 id = configId();
        bytes memory data = abi.encode(policies(2, MockExecutionPolicy.Mode.Pass));

        bytes memory initialization =
            abi.encodeCall(SessionHook.initializeWithMultiplexer, (address(account), id, data));
        bytes memory forward =
            abi.encodeCall(MockSmartSessionViews.forward, (address(hook), initialization));
        bytes memory execData = tagged(executeSingle(address(target)));

        vm.expectRevert(
            abi.encodeWithSelector(SessionHook.ReentrantCheck.selector, address(account))
        );
        account.callDuringCheck(IHook(address(hook)), execData, address(smartSession), forward);
        assertEq(hook.getExecutionPolicies(address(account), PERMISSION).length, 1);

        // Between operations, Smart Sessions may reinitialize them.
        smartSession.forward(address(hook), initialization);
        assertEq(hook.getExecutionPolicies(address(account), PERMISSION).length, 2);
    }

    function test_execution_requiresTheSessionToStillUseTheHook() public {
        install();
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
        hook.onInstall(abi.encode(address(probe)));
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
        install();
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
        install();
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

    /// @dev The tag is a wire format: the SDK appends `permissionId ‖ keccak256("namera.session-hook.tag")`, and
    /// the policies strip it before reading the stated time.
    function test_views_theTagIsTheWireFormat() public view {
        assertEq(hook.TAG(), keccak256("namera.session-hook.tag"));
        assertEq(hook.TAG(), UserOpCalls.SESSION_HOOK_TAG);
        assertEq(hook.tag(PERMISSION), abi.encodePacked(PERMISSION, hook.TAG()));
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

    function install() internal {
        vm.prank(address(account));
        hook.onInstall(abi.encode(address(smartSession)));
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
