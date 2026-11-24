// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";
import {EIP712} from "solady/utils/EIP712.sol";
import {MerkleProofLib} from "solady/utils/MerkleProofLib.sol";

import {WebAuthnAssertion} from "./lib/WebAuthnAssertion.sol";

/// @title WebAuthnValidator
/// @notice ERC-7579 validator for passkey owners (module type 1) on Kernel 3.3, and stateless passkey
/// verifier for Smart Sessions session keys (module type 7). An account holds up to 16 passkeys and a threshold.
/// @dev Implements the ERC-7579 and ISessionValidator ABIs without inheriting their interfaces, so the contract stays
/// Apache-2.0.
///
/// Signature (packed, every length checked; trailing bytes are invalid):
///
///     signature := mode (1) ‖ backend (1) ‖ [multichain: root (32) ‖ proofLength (1) ‖ proof (32 × proofLength)]
///                  ‖ count (1) ‖ assertion × count
///     assertion := credentialId (32) ‖ r (32) ‖ s (32) ‖ challengeIndex (2) ‖ typeIndex (2)
///                  ‖ authenticatorDataLength (2) ‖ authenticatorData ‖ clientDataJSONLength (2) ‖ clientDataJSON
///
/// - `mode` 0 (direct): every assertion signs the hash being validated. Mode 1 (multichain, user operations only):
///   every assertion signs `multichainChallenge(root)`, and `proof` shows `keccak256(abi.encode(userOpHash))` is a
///   leaf of `root`, so one passkey prompt covers user operations on several chains.
/// - `backend` 0 verifies P-256 with the precompile at `0x100`, 1 in Solidity.
/// - `count` assertions, at least the threshold, with strictly increasing credential ids, each a registered passkey.
///
/// ERC-1271 digests are bound to the account and chain: the passkey signs `replaySafeHash(account, hash)`, an EIP-712
/// digest in this validator's domain. The bare hash is accepted only when the account asks for itself
/// (`sender == account`), which Kernel's enable flows do with digests already bound to the account.
///
/// Storage is keyed so every slot is associated with the account (ERC-7562): `credentialId => account => passkey`,
/// `index => account => credentialId` and `account => (count, threshold)`.
// slither-disable-next-line missing-inheritance
contract WebAuthnValidator is EIP712 {
    struct Stored {
        bytes32 x;
        bytes32 y;
        bytes32 rpIdHash;
        bool requireUserVerification;
        /// @dev One plus the passkey's index in the account's list; zero when not registered.
        uint8 position;
    }

    struct Config {
        uint8 count;
        uint8 threshold;
    }

    /// @dev Where a signature's assertions start and what they sign.
    struct Envelope {
        bytes32 challenge;
        bool precompile;
        /// @dev Whether the passkeys come from the caller (Smart Sessions' config) instead of storage.
        bool stateless;
        /// @dev Whether the hash is what the passkeys signed: always in direct mode, a leaf of the root in multichain
        /// mode. A failed proof still has its assertions checked, so estimation with a stub pays for them.
        bool proven;
        uint256 count;
        /// @dev Where the next assertion starts.
        uint256 cursor;
        /// @dev The last assertion's credential id; ids must strictly increase.
        bytes32 previous;
    }

    uint256 internal constant MODULE_TYPE_VALIDATOR = 1;
    uint256 internal constant MODULE_TYPE_STATELESS_VALIDATOR = 7;
    /// @notice The most passkeys an account may hold.
    uint256 public constant MAX_PASSKEYS = 16;

    uint8 internal constant MODE_DIRECT = 0;
    uint8 internal constant MODE_MULTICHAIN = 1;
    uint8 internal constant BACKEND_PRECOMPILE = 0;
    uint8 internal constant BACKEND_SOLIDITY = 1;

    /// @dev mode (1) ‖ backend (1).
    uint256 internal constant DIRECT_HEADER_LENGTH = 2;
    /// @dev mode (1) ‖ backend (1) ‖ root (32) ‖ proofLength (1).
    uint256 internal constant MULTICHAIN_HEADER_LENGTH = 35;
    /// @dev credentialId (32) ‖ r (32) ‖ s (32) ‖ challengeIndex (2) ‖ typeIndex (2) ‖ authenticatorDataLength (2).
    uint256 internal constant ASSERTION_HEAD_LENGTH = 102;

    uint256 internal constant VALIDATION_SUCCESS = 0;
    uint256 internal constant VALIDATION_FAILED = 1;
    bytes4 internal constant ERC1271_VALID = 0x1626ba7e;
    bytes4 internal constant ERC1271_INVALID = 0xffffffff;

    /// @notice EIP-712 type hash of `ReplaySafeHash`, which binds an ERC-1271 digest to the account.
    bytes32 public constant REPLAY_SAFE_HASH_TYPEHASH =
        keccak256("ReplaySafeHash(address account,bytes32 hash)");
    /// @notice EIP-712 type hash of `WebAuthnMultichain`, the challenge of a multichain signature.
    bytes32 public constant MULTICHAIN_TYPEHASH = keccak256("WebAuthnMultichain(bytes32 root)");

    mapping(bytes32 credentialId => mapping(address account => Stored)) internal $passkeys;
    mapping(uint256 index => mapping(address account => bytes32)) internal $credentialIds;
    mapping(address account => Config) internal $configs;

    event PasskeyAdded(address indexed account, bytes32 indexed credentialId, bytes32 x, bytes32 y);
    event PasskeyRemoved(address indexed account, bytes32 indexed credentialId);
    event ThresholdSet(address indexed account, uint256 threshold);

    error InvalidPasskey(bytes32 x, bytes32 y);
    error DuplicatePasskey(bytes32 credentialId);
    error TooManyPasskeys(uint256 max);
    error InvalidThreshold(uint256 threshold, uint256 count);
    error PasskeyNotFound(bytes32 credentialId);
    error NotInitialized(address account);

    // ---------------------------------------------------------------------------------------------
    // ERC-7579 module
    // ---------------------------------------------------------------------------------------------

    /// @notice Installs the validator on the calling account with its passkeys and threshold.
    /// @dev Overwrites any state left by an earlier install: every account swallows `onUninstall` failures.
    /// @param data `abi.encode(uint256 threshold, WebAuthnAssertion.Passkey[] passkeys)`.
    function onInstall(bytes calldata data) external {
        (uint256 threshold, WebAuthnAssertion.Passkey[] memory passkeys) =
            abi.decode(data, (uint256, WebAuthnAssertion.Passkey[]));
        _clear(msg.sender);
        uint256 length = passkeys.length;
        for (uint256 i; i < length; ++i) {
            _add(msg.sender, passkeys[i]);
        }
        _setThreshold(msg.sender, threshold);
    }

    /// @notice Removes the calling account's passkeys and threshold.
    function onUninstall(bytes calldata) external {
        _clear(msg.sender);
    }

    /// @notice Whether `account` has passkeys.
    function isInitialized(address account) external view returns (bool) {
        return $configs[account].count != 0;
    }

    /// @notice Whether the validator is of ERC-7579 module type `moduleTypeId`: a validator (1) or a stateless
    /// validator (7).
    function isModuleType(uint256 moduleTypeId) external pure returns (bool) {
        return
            moduleTypeId == MODULE_TYPE_VALIDATOR || moduleTypeId == MODULE_TYPE_STATELESS_VALIDATOR;
    }

    // ---------------------------------------------------------------------------------------------
    // Passkey management, called by the account
    // ---------------------------------------------------------------------------------------------

    /// @notice Adds a passkey to the calling account.
    function addPasskey(WebAuthnAssertion.Passkey calldata passkey) external {
        _requireInitialized(msg.sender);
        _add(msg.sender, passkey);
    }

    /// @notice Removes the calling account's passkey `id`; the threshold must stay reachable.
    function removePasskey(bytes32 id) external {
        _requireInitialized(msg.sender);
        if ($passkeys[id][msg.sender].position == 0) revert PasskeyNotFound(id);
        Config memory config = $configs[msg.sender];
        if (config.count - 1 < config.threshold) {
            revert InvalidThreshold(config.threshold, config.count - 1);
        }
        _remove(msg.sender, id);
    }

    /// @notice Sets how many of the calling account's passkeys must sign.
    function setThreshold(uint256 threshold) external {
        _requireInitialized(msg.sender);
        _setThreshold(msg.sender, threshold);
    }

    // ---------------------------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------------------------

    /// @notice Validates a user operation of the calling account: ERC-4337 validation data, 0 or 1.
    function validateUserOp(ERC4337.PackedUserOperation calldata userOp, bytes32 userOpHash)
        external
        view
        returns (uint256)
    {
        (bool parsed, Envelope memory envelope) = _open(userOp.signature, userOpHash, true);
        if (!parsed) return VALIDATION_FAILED;
        return _verify(
            envelope,
            userOp.signature,
            msg.sender,
            new WebAuthnAssertion.Passkey[](0),
            $configs[msg.sender].threshold
        )
            ? VALIDATION_SUCCESS
            : VALIDATION_FAILED;
    }

    /// @notice ERC-7579 ERC-1271 forwarding: whether the calling account's passkeys signed `hash`.
    /// @dev An empty signature (an account's ERC-7739 support probe) is invalid, never a revert.
    function isValidSignatureWithSender(address sender, bytes32 hash, bytes calldata signature)
        external
        view
        returns (bytes4)
    {
        bytes32 challenge = sender == msg.sender ? hash : replaySafeHash(msg.sender, hash);
        (bool parsed, Envelope memory envelope) = _open(signature, challenge, false);
        if (!parsed) return ERC1271_INVALID;
        return _verify(
            envelope,
            signature,
            msg.sender,
            new WebAuthnAssertion.Passkey[](0),
            $configs[msg.sender].threshold
        )
            ? ERC1271_VALID
            : ERC1271_INVALID;
    }

    /// @notice Smart Sessions' session validator check (stateless): the passkeys come from the session's config.
    /// @param data `abi.encode(uint256 threshold, WebAuthnAssertion.Passkey[] passkeys)`, as for `onInstall`.
    function validateSignatureWithData(bytes32 hash, bytes calldata signature, bytes calldata data)
        external
        view
        returns (bool)
    {
        (uint256 threshold, WebAuthnAssertion.Passkey[] memory passkeys) =
            abi.decode(data, (uint256, WebAuthnAssertion.Passkey[]));
        (bool parsed, Envelope memory envelope) = _open(signature, hash, false);
        envelope.stateless = true;
        return parsed && _verify(envelope, signature, address(0), passkeys, threshold);
    }

    // ---------------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------------

    /// @notice The account's threshold and passkeys, in the order they were added (removal moves the last one).
    function getPasskeys(address account)
        external
        view
        returns (
            uint256 threshold,
            bytes32[] memory credentialIds,
            WebAuthnAssertion.Passkey[] memory passkeys
        )
    {
        Config memory config = $configs[account];
        credentialIds = new bytes32[](config.count);
        passkeys = new WebAuthnAssertion.Passkey[](config.count);
        for (uint256 i; i < config.count; ++i) {
            bytes32 id = $credentialIds[i][account];
            Stored storage stored = $passkeys[id][account];
            credentialIds[i] = id;
            passkeys[i] = WebAuthnAssertion.Passkey(
                stored.x, stored.y, stored.requireUserVerification, stored.rpIdHash
            );
        }
        return (config.threshold, credentialIds, passkeys);
    }

    /// @notice What a passkey signs for an ERC-1271 check of `hash` on `account`.
    function replaySafeHash(address account, bytes32 hash) public view returns (bytes32) {
        return _hashTypedData(keccak256(abi.encode(REPLAY_SAFE_HASH_TYPEHASH, account, hash)));
    }

    /// @notice What a passkey signs to approve every user operation under a multichain `root`.
    function multichainChallenge(bytes32 root) public pure returns (bytes32) {
        return keccak256(abi.encode(MULTICHAIN_TYPEHASH, root));
    }

    /// @notice The id of the passkey with public key `(x, y)`.
    function credentialId(bytes32 x, bytes32 y) public pure returns (bytes32) {
        return keccak256(abi.encode(x, y));
    }

    // ---------------------------------------------------------------------------------------------
    // Internal functions
    // ---------------------------------------------------------------------------------------------

    function _domainNameAndVersion() internal pure override returns (string memory, string memory) {
        return ("WebAuthnValidator", "1");
    }

    /// @dev Reads the signature's header. Multichain mode is accepted for user operations only.
    function _open(bytes calldata signature, bytes32 hash, bool userOperation)
        internal
        pure
        returns (bool, Envelope memory envelope)
    {
        if (signature.length < 3) return (false, envelope);
        uint8 mode = uint8(signature[0]);
        uint8 backend = uint8(signature[1]);
        if (backend > BACKEND_SOLIDITY) return (false, envelope);
        envelope.precompile = backend == BACKEND_PRECOMPILE;
        uint256 cursor = DIRECT_HEADER_LENGTH;

        if (mode == MODE_DIRECT) {
            envelope.challenge = hash;
            envelope.proven = true;
        } else if (mode == MODE_MULTICHAIN && userOperation) {
            if (signature.length < MULTICHAIN_HEADER_LENGTH) return (false, envelope);
            bytes32 root = bytes32(signature[DIRECT_HEADER_LENGTH:DIRECT_HEADER_LENGTH + 32]);
            uint256 proofLength = uint8(signature[MULTICHAIN_HEADER_LENGTH - 1]);
            cursor = MULTICHAIN_HEADER_LENGTH + proofLength * 32;
            if (signature.length < cursor) return (false, envelope);
            bytes32[] memory proof = new bytes32[](proofLength);
            for (uint256 i; i < proofLength; ++i) {
                uint256 start = MULTICHAIN_HEADER_LENGTH + i * 32;
                proof[i] = bytes32(signature[start:start + 32]);
            }
            envelope.proven = MerkleProofLib.verify(proof, root, keccak256(abi.encode(hash)));
            envelope.challenge = multichainChallenge(root);
        } else {
            return (false, envelope);
        }

        if (signature.length < cursor + 1) return (false, envelope);
        envelope.count = uint8(signature[cursor]);
        envelope.cursor = cursor + 1;
        return (true, envelope);
    }

    /// @dev Checks `envelope.count` assertions against the account's passkeys, or against `passkeys` when the
    /// validation is stateless. Strictly increasing credential ids make each passkey count once, so at most as many
    /// assertions as there are passkeys can be valid. A zero threshold (no passkeys) never validates.
    function _verify(
        Envelope memory envelope,
        bytes calldata signature,
        address account,
        WebAuthnAssertion.Passkey[] memory passkeys,
        uint256 threshold
    ) internal view returns (bool) {
        if (threshold == 0 || envelope.count < threshold) return false;
        bool valid = envelope.proven;
        for (uint256 i; i < envelope.count; ++i) {
            (bool parsed, bool assertionValid) =
                _next(envelope, signature, account, passkeys, i == 0);
            if (!parsed) return false;
            valid = assertionValid && valid;
        }
        return valid && envelope.cursor == signature.length;
    }

    /// @dev Reads the assertion at `envelope.cursor`, finds its passkey and checks it, then moves the cursor past it.
    /// `parsed` is false when the assertion does not fit, its id is out of order or its passkey is unknown.
    function _next(
        Envelope memory envelope,
        bytes calldata signature,
        address account,
        WebAuthnAssertion.Passkey[] memory passkeys,
        bool first
    ) internal view returns (bool parsed, bool valid) {
        uint256 cursor = envelope.cursor;
        if (signature.length < cursor + ASSERTION_HEAD_LENGTH) return (false, false);
        bytes32 id = bytes32(signature[cursor:cursor + 32]);
        if (!first && uint256(id) <= uint256(envelope.previous)) return (false, false);
        envelope.previous = id;
        (bool found, WebAuthnAssertion.Passkey memory passkey) =
            envelope.stateless ? _find(passkeys, id) : _stored(account, id);
        if (!found) return (false, false);
        (parsed, valid, envelope.cursor) = _verifyAssertion(envelope, signature, cursor, passkey);
    }

    /// @dev Reads and checks the assertion at `cursor`; `parsed` is false when it does not fit in the signature.
    function _verifyAssertion(
        Envelope memory envelope,
        bytes calldata signature,
        uint256 cursor,
        WebAuthnAssertion.Passkey memory passkey
    ) internal view returns (bool parsed, bool valid, uint256 next) {
        // Filled field by field below, before any use.
        // slither-disable-next-line uninitialized-local
        WebAuthnAssertion.Assertion memory assertion;
        assertion.authenticatorDataStart = cursor + ASSERTION_HEAD_LENGTH;
        assertion.authenticatorDataEnd = assertion.authenticatorDataStart
            + uint16(bytes2(signature[cursor + 100:cursor + ASSERTION_HEAD_LENGTH]));
        assertion.clientDataJSONStart = assertion.authenticatorDataEnd + 2;
        if (signature.length < assertion.clientDataJSONStart) return (false, false, 0);
        assertion.clientDataJSONEnd = assertion.clientDataJSONStart
            + uint16(
                bytes2(signature[assertion.authenticatorDataEnd:assertion.clientDataJSONStart])
            );
        if (signature.length < assertion.clientDataJSONEnd) return (false, false, 0);
        assertion.r = bytes32(signature[cursor + 32:cursor + 64]);
        assertion.s = bytes32(signature[cursor + 64:cursor + 96]);
        assertion.challengeIndex = uint16(bytes2(signature[cursor + 96:cursor + 98]));
        assertion.typeIndex = uint16(bytes2(signature[cursor + 98:cursor + 100]));
        valid = WebAuthnAssertion.verify(
            envelope.challenge, signature, assertion, passkey, envelope.precompile
        );
        return (true, valid, assertion.clientDataJSONEnd);
    }

    /// @dev The account's passkey `id`, and whether it is registered.
    function _stored(address account, bytes32 id)
        internal
        view
        returns (bool, WebAuthnAssertion.Passkey memory passkey)
    {
        Stored storage stored = $passkeys[id][account];
        if (stored.position == 0) return (false, passkey);
        return (
            true,
            WebAuthnAssertion.Passkey(
                stored.x, stored.y, stored.requireUserVerification, stored.rpIdHash
            )
        );
    }

    /// @dev The passkey of `passkeys` with credential id `id`, and whether there is one.
    function _find(WebAuthnAssertion.Passkey[] memory passkeys, bytes32 id)
        internal
        pure
        returns (bool, WebAuthnAssertion.Passkey memory passkey)
    {
        uint256 length = passkeys.length;
        for (uint256 i; i < length; ++i) {
            if (credentialId(passkeys[i].x, passkeys[i].y) == id) return (true, passkeys[i]);
        }
        return (false, passkey);
    }

    function _add(address account, WebAuthnAssertion.Passkey memory passkey) internal {
        if (!WebAuthnAssertion.isValidPublicKey(passkey.x, passkey.y)) {
            revert InvalidPasskey(passkey.x, passkey.y);
        }
        bytes32 id = credentialId(passkey.x, passkey.y);
        Stored storage stored = $passkeys[id][account];
        if (stored.position != 0) revert DuplicatePasskey(id);
        Config storage config = $configs[account];
        uint256 count = config.count;
        if (count == MAX_PASSKEYS) revert TooManyPasskeys(MAX_PASSKEYS);

        $credentialIds[count][account] = id;
        stored.x = passkey.x;
        stored.y = passkey.y;
        stored.rpIdHash = passkey.rpIdHash;
        stored.requireUserVerification = passkey.requireUserVerification;
        // `count < MAX_PASSKEYS` (16), so both fit in a uint8.
        // forge-lint: disable-next-line(unsafe-typecast)
        stored.position = uint8(count + 1);
        // forge-lint: disable-next-line(unsafe-typecast)
        config.count = uint8(count + 1);
        // No external call precedes this: the lint reads the internal P-256 key check as one.
        // forge-lint: disable-next-line(reentrancy-events)
        emit PasskeyAdded(account, id, passkey.x, passkey.y);
    }

    /// @dev Moves the last passkey into the removed one's index. The caller checks `id` is registered.
    function _remove(address account, bytes32 id) internal {
        uint256 position = $passkeys[id][account].position;
        Config storage config = $configs[account];
        uint256 last = config.count - 1;
        if (position - 1 != last) {
            bytes32 moved = $credentialIds[last][account];
            $credentialIds[position - 1][account] = moved;
            // Positions are at most MAX_PASSKEYS (16).
            // forge-lint: disable-next-line(unsafe-typecast)
            $passkeys[moved][account].position = uint8(position);
        }
        delete $credentialIds[last][account];
        delete $passkeys[id][account];
        // `last < count <= MAX_PASSKEYS` (16).
        // forge-lint: disable-next-line(unsafe-typecast)
        config.count = uint8(last);
        emit PasskeyRemoved(account, id);
    }

    function _setThreshold(address account, uint256 threshold) internal {
        Config storage config = $configs[account];
        if (threshold == 0 || threshold > config.count) {
            revert InvalidThreshold(threshold, config.count);
        }
        // `threshold <= count <= MAX_PASSKEYS` (16).
        // forge-lint: disable-next-line(unsafe-typecast)
        config.threshold = uint8(threshold);
        // No external call precedes this: the lint reads the internal P-256 key check in `onInstall` as one.
        // forge-lint: disable-next-line(reentrancy-events)
        emit ThresholdSet(account, threshold);
    }

    /// @dev Removes every passkey of `account` and its threshold.
    function _clear(address account) internal {
        uint256 count = $configs[account].count;
        for (uint256 i; i < count; ++i) {
            bytes32 id = $credentialIds[i][account];
            delete $passkeys[id][account];
            delete $credentialIds[i][account];
            emit PasskeyRemoved(account, id);
        }
        delete $configs[account];
    }

    function _requireInitialized(address account) internal view {
        if ($configs[account].count == 0) revert NotInitialized(account);
    }
}
