// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC4337} from "solady/accounts/ERC4337.sol";
import {LibERC7579} from "solady/accounts/LibERC7579.sol";
import {ECDSA} from "solady/utils/ECDSA.sol";
import {LibZip} from "solady/utils/LibZip.sol";

import {
    ChainDigest,
    EnableSession,
    PermissionId,
    Session,
    SmartSessionMode,
    ValidationData
} from "src/smart-sessions/DataTypes.sol";
import {SmartSession} from "src/smart-sessions/SmartSession.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";
import {Execution} from "src/smart-sessions/lib/ExecutionLib.sol";
import {ECDSASessionValidator} from "src/validators/ECDSASessionValidator.sol";

import {EntryPointFixture, IEntryPoint} from "./EntryPoint.sol";
import {SessionBuilder} from "./SessionBuilder.sol";
import {SessionTypes} from "./SessionTypes.sol";
import {MockAccount} from "./mocks/MockAccount.sol";
import {MockPolicy, MockPolicyConfig} from "./mocks/MockPolicy.sol";
import {MockTarget} from "./mocks/MockTarget.sol";

/// @notice Shared setup for SmartSession tests: the canonical EntryPoint, the module, the ECDSA session
/// validator, mock policies and an ERC-7579 mock account with SmartSession installed.
abstract contract SmartSessionTestBase is Test {
    using SessionBuilder for Session;

    uint256 internal constant MODULE_TYPE_VALIDATOR = 1;
    /// @dev Validation data for "valid, no expiry": SmartSession intersects results, which sets
    /// `validUntil = type(uint48).max` when unbounded.
    uint256 internal constant VALID = uint256(type(uint48).max) << 160;
    uint256 internal constant SIG_FAILED = 1;
    bytes4 internal constant EIP1271_MAGIC = 0x1626ba7e;
    bytes4 internal constant SET_VALUE = MockTarget.setValue.selector;

    IEntryPoint internal entryPoint = EntryPointFixture.ENTRY_POINT;
    SmartSession internal smartSession;
    ECDSASessionValidator internal sessionValidator;
    MockPolicy internal policy;
    MockAccount internal account;
    MockTarget internal target;

    address internal owner;
    uint256 internal ownerKey;
    address internal sessionSigner;
    uint256 internal sessionKey;

    function setUp() public virtual {
        EntryPointFixture.install();
        smartSession = new SmartSession();
        sessionValidator = new ECDSASessionValidator();
        policy = new MockPolicy(true);
        target = new MockTarget();

        (owner, ownerKey) = makeAddrAndKey("owner");
        (sessionSigner, sessionKey) = makeAddrAndKey("sessionSigner");
        account = new MockAccount(owner);
        vm.deal(address(account), 100 ether);
        installSmartSession(address(account), "");
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Sessions
    // -----------------------------------------------------------------------------------------------------------------

    /// @dev A session signed by `sessionSigner` that may call `target.setValue` (policy allows everything).
    function defaultSession() internal view returns (Session memory) {
        return SessionBuilder.create(
                ISessionValidator(address(sessionValidator)),
                SessionBuilder.ecdsaConfig(sessionSigner),
                keccak256("default")
            )
            .withAction(address(target), SET_VALUE, address(policy), MockPolicyConfig.allow());
    }

    function installSmartSession(address smartAccount, bytes memory initData) internal {
        vm.prank(smartAccount);
        MockAccount(payable(smartAccount))
            .installModule(MODULE_TYPE_VALIDATOR, address(smartSession), initData);
    }

    function enableSession(Session memory session) internal returns (PermissionId) {
        return enableSession(address(account), session);
    }

    function enableSession(address smartAccount, Session memory session)
        internal
        returns (PermissionId)
    {
        Session[] memory sessions = new Session[](1);
        sessions[0] = session;
        vm.prank(smartAccount);
        PermissionId[] memory ids = smartSession.enableSessions(sessions);
        // Empty when the call was expected to revert (`vm.expectRevert`).
        return ids.length == 0 ? PermissionId.wrap(0) : ids[0];
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Calldata
    // -----------------------------------------------------------------------------------------------------------------

    function executeSingle(address to, uint256 value, bytes memory data)
        internal
        pure
        returns (bytes memory)
    {
        bytes32 mode = LibERC7579.encodeMode(
            LibERC7579.CALLTYPE_SINGLE, LibERC7579.EXECTYPE_DEFAULT, bytes4(0), bytes22(0)
        );
        return abi.encodeCall(MockAccount.execute, (mode, abi.encodePacked(to, value, data)));
    }

    function executeBatch(Execution[] memory executions) internal pure returns (bytes memory) {
        bytes32 mode = LibERC7579.encodeMode(
            LibERC7579.CALLTYPE_BATCH, LibERC7579.EXECTYPE_DEFAULT, bytes4(0), bytes22(0)
        );
        return abi.encodeCall(MockAccount.execute, (mode, abi.encode(executions)));
    }

    function callSetValue(uint256 value) internal view returns (bytes memory) {
        return executeSingle(address(target), 0, abi.encodeCall(MockTarget.setValue, (value)));
    }

    // -----------------------------------------------------------------------------------------------------------------
    // User operations
    // -----------------------------------------------------------------------------------------------------------------

    /// @dev An unsigned user op of `account` on the SmartSession nonce lane.
    function userOp(bytes memory callData)
        internal
        view
        returns (ERC4337.PackedUserOperation memory op)
    {
        return userOp(address(account), callData);
    }

    function userOp(address sender, bytes memory callData)
        internal
        view
        returns (ERC4337.PackedUserOperation memory op)
    {
        uint192 key = sessionNonceKey();
        op.sender = sender;
        op.nonce = entryPoint.getNonce(sender, key);
        op.callData = wrapCallData(callData);
        op.accountGasLimits = bytes32((uint256(2_000_000) << 128) | 1_000_000);
        op.preVerificationGas = 100_000;
        op.gasFees = bytes32((uint256(1 gwei) << 128) | 1 gwei);
    }

    /// @dev How the account receives a session operation's calldata: as is, or (Kernel with SessionHook bound to
    /// SmartSession) wrapped in `executeUserOp`.
    function wrapCallData(bytes memory callData) internal view virtual returns (bytes memory) {
        return callData;
    }

    /// @dev Nonce key that routes a user op to SmartSession. MockAccount: validator address in the top 20 bytes.
    function sessionNonceKey() internal view virtual returns (uint192) {
        return uint192(uint160(address(smartSession))) << 32;
    }

    /// @dev The owner's ERC-1271 signature over `digest`, formatted for the account. MockAccount: raw ECDSA.
    function ownerSignature(address, bytes32 digest) internal view virtual returns (bytes memory) {
        return signRaw(ownerKey, digest);
    }

    function signUse(ERC4337.PackedUserOperation memory op, PermissionId permissionId)
        internal
        view
        returns (ERC4337.PackedUserOperation memory)
    {
        op.signature = abi.encodePacked(
            SmartSessionMode.USE, permissionId, signUserOpHash(op, sessionKey)
        );
        return op;
    }

    /// @dev Enables `session` inside `op`, signed by the owner for this chain only.
    function signEnable(ERC4337.PackedUserOperation memory op, Session memory session)
        internal
        view
        returns (ERC4337.PackedUserOperation memory)
    {
        return signEnable(op, session, SmartSessionMode.ENABLE);
    }

    function signEnable(
        ERC4337.PackedUserOperation memory op,
        Session memory session,
        SmartSessionMode mode
    ) internal view returns (ERC4337.PackedUserOperation memory) {
        EnableSession memory data = enableData(op.sender, session, mode);
        op.signature = encodeEnableSignature(mode, data, signUserOpHash(op, sessionKey));
        return op;
    }

    function enableData(address smartAccount, Session memory session, SmartSessionMode mode)
        internal
        view
        returns (EnableSession memory data)
    {
        ChainDigest[] memory digests = new ChainDigest[](1);
        digests[0] = ChainDigest({
            chainId: uint64(block.chainid),
            sessionDigest: sessionDigest(smartAccount, session, mode)
        });
        data.chainDigestIndex = 0;
        data.hashesAndChainIds = digests;
        data.sessionToEnable = session;
        data.permissionEnableSig = ownerSignature(smartAccount, multichainDigest(digests));
    }

    function encodeEnableSignature(
        SmartSessionMode mode,
        EnableSession memory data,
        bytes memory sessionKeySignature
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(mode, LibZip.flzCompress(abi.encode(data, sessionKeySignature)));
    }

    function sessionDigest(address smartAccount, Session memory session, SmartSessionMode mode)
        internal
        view
        returns (bytes32)
    {
        PermissionId permissionId = smartSession.getPermissionId(session);
        return smartSession.getSessionDigest(permissionId, smartAccount, session, mode);
    }

    /// @dev EIP-712 digest of `MultiChainSession` over the given per-chain digests, computed independently of
    /// HashLib from the type strings.
    function multichainDigest(ChainDigest[] memory digests) internal pure returns (bytes32) {
        bytes32 chainSessionTypehash = vm.eip712HashType(SessionTypes.chainSession());
        bytes32[] memory entries = new bytes32[](digests.length);
        for (uint256 i; i < digests.length; ++i) {
            entries[i] = keccak256(
                abi.encode(chainSessionTypehash, digests[i].chainId, digests[i].sessionDigest)
            );
        }
        bytes32 structHash = keccak256(
            abi.encode(
                vm.eip712HashType(SessionTypes.multichainSession()),
                keccak256(abi.encodePacked(entries))
            )
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version)"),
                keccak256("SmartSession"),
                keccak256("1")
            )
        );
        return keccak256(abi.encodePacked(hex"1901", domainSeparator, structHash));
    }

    /// @dev Calls `validateUserOp` as the account would; the only external call, so `vm.expectRevert` applies to it.
    function validate(ERC4337.PackedUserOperation memory op) internal returns (uint256) {
        bytes32 opHash = userOpHash(op);
        vm.prank(op.sender);
        return ValidationData.unwrap(smartSession.validateUserOp(op, opHash));
    }

    /// @dev EntryPoint v0.7 `getUserOpHash`, computed locally so it makes no external call before the one
    /// `vm.expectRevert` targets. Every `handleOp` test checks it: the EntryPoint rejects signatures over any
    /// other hash.
    function userOpHash(ERC4337.PackedUserOperation memory op) internal view returns (bytes32) {
        bytes32 packed = keccak256(
            abi.encode(
                op.sender,
                op.nonce,
                keccak256(op.initCode),
                keccak256(op.callData),
                op.accountGasLimits,
                op.preVerificationGas,
                op.gasFees,
                keccak256(op.paymasterAndData)
            )
        );
        return keccak256(abi.encode(packed, address(entryPoint), block.chainid));
    }

    function handleOp(ERC4337.PackedUserOperation memory op) internal {
        ERC4337.PackedUserOperation[] memory ops = new ERC4337.PackedUserOperation[](1);
        ops[0] = op;
        entryPoint.handleOps(ops, payable(makeAddr("beneficiary")));
    }

    // -----------------------------------------------------------------------------------------------------------------
    // Signatures
    // -----------------------------------------------------------------------------------------------------------------

    function signUserOpHash(ERC4337.PackedUserOperation memory op, uint256 key)
        internal
        view
        returns (bytes memory)
    {
        return signEthMessage(key, userOpHash(op));
    }

    function signEthMessage(uint256 key, bytes32 hash) internal pure returns (bytes memory) {
        return signRaw(key, ECDSA.toEthSignedMessageHash(hash));
    }

    function signRaw(uint256 key, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }
}
