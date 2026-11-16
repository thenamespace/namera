// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {CommonBase} from "forge-std/Base.sol";
import {StdUtils} from "forge-std/StdUtils.sol";

import {PermissionId, Session} from "src/smart-sessions/DataTypes.sol";
import {SmartSession} from "src/smart-sessions/SmartSession.sol";
import {ISessionValidator} from "src/smart-sessions/interfaces/ISessionValidator.sol";

import {ERC7739Signer} from "../../utils/ERC7739Signer.sol";
import {SessionBuilder} from "../../utils/SessionBuilder.sol";
import {MockAccount} from "../../utils/mocks/MockAccount.sol";
import {MockPolicyConfig} from "../../utils/mocks/MockPolicy.sol";

/// @notice Drives random session lifecycles across accounts and records what the invariants check.
contract SessionHandler is CommonBase, StdUtils {
    using SessionBuilder for Session;

    bytes4 internal constant EIP1271_MAGIC = 0x1626ba7e;
    bytes32 internal constant APP_DOMAIN = keccak256("invariant app");

    struct TrackedSession {
        MockAccount account;
        PermissionId permissionId;
        uint48 validAfter;
        uint48 validUntil;
        bool enabled;
    }

    SmartSession public immutable smartSession;
    ISessionValidator public immutable sessionValidator;
    address public immutable policy;
    uint256 public immutable sessionKey;
    address public immutable sessionSigner;

    MockAccount[] public accounts;
    TrackedSession[] internal sessions;
    uint256 internal saltNonce;

    bool public signatureAcceptedForOtherHash;
    bool public signatureAcceptedOutsideWindow;

    constructor(
        SmartSession smartSession_,
        ISessionValidator sessionValidator_,
        address policy_,
        MockAccount[] memory accounts_,
        uint256 sessionKey_
    ) {
        smartSession = smartSession_;
        sessionValidator = sessionValidator_;
        policy = policy_;
        accounts = accounts_;
        sessionKey = sessionKey_;
        sessionSigner = vm.addr(sessionKey_);
    }

    function enable(uint256 accountSeed, uint48 validAfterOffset, uint48 duration) external {
        MockAccount account = accounts[accountSeed % accounts.length];
        uint48 validAfter = uint48(block.timestamp) + uint48(bound(validAfterOffset, 0, 2 days));
        uint48 validUntil = validAfter + uint48(bound(duration, 1, 7 days));
        Session memory session = _session(validAfter, validUntil);

        Session[] memory batch = new Session[](1);
        batch[0] = session;
        vm.prank(address(account));
        PermissionId permissionId = smartSession.enableSessions(batch)[0];

        sessions.push(TrackedSession(account, permissionId, validAfter, validUntil, true));
    }

    function remove(uint256 sessionSeed) external {
        if (sessions.length == 0) return;
        TrackedSession storage tracked = sessions[sessionSeed % sessions.length];
        if (!tracked.enabled) return;

        vm.prank(address(tracked.account));
        smartSession.removeSession(tracked.permissionId);
        tracked.enabled = false;
    }

    function warp(uint256 seconds_) external {
        vm.warp(block.timestamp + bound(seconds_, 0, 3 days));
    }

    /// @dev Signs a message and records if the signature is accepted where it must not be.
    function signAndCheck(uint256 sessionSeed, bytes32 otherHash) external {
        if (sessions.length == 0) return;
        TrackedSession memory tracked = sessions[sessionSeed % sessions.length];
        if (!tracked.enabled) return;

        ERC7739Signer.AppData memory mail = ERC7739Signer.mail(APP_DOMAIN, address(0xBEEF));
        bytes memory signature = abi.encodePacked(
            address(smartSession),
            ERC7739Signer.sign(mail, address(tracked.account), tracked.permissionId, sessionKey)
        );
        bytes32 signedHash = ERC7739Signer.appHash(mail);

        if (otherHash != signedHash && _isMagic(tracked.account, otherHash, signature)) {
            signatureAcceptedForOtherHash = true;
        }
        bool insideWindow =
            block.timestamp > tracked.validAfter && block.timestamp <= tracked.validUntil;
        if (!insideWindow && _isMagic(tracked.account, signedHash, signature)) {
            signatureAcceptedOutsideWindow = true;
        }
    }

    function sessionCount() external view returns (uint256) {
        return sessions.length;
    }

    function sessionAt(uint256 index) external view returns (TrackedSession memory) {
        return sessions[index];
    }

    function accountCount() external view returns (uint256) {
        return accounts.length;
    }

    function _session(uint48 validAfter, uint48 validUntil) internal returns (Session memory) {
        return SessionBuilder.create(
                sessionValidator,
                SessionBuilder.ecdsaConfig(sessionSigner),
                keccak256(abi.encode(saltNonce++))
            )
            .withFallbackAction(policy, MockPolicyConfig.allow())
            .withERC7739Content(APP_DOMAIN, "Mail(address to)")
            .withERC1271Policy(policy, MockPolicyConfig.allow())
            .withValidity(validAfter, validUntil);
    }

    function _isMagic(MockAccount account, bytes32 hash, bytes memory signature)
        internal
        view
        returns (bool)
    {
        return account.isValidSignature(hash, signature) == EIP1271_MAGIC;
    }
}
