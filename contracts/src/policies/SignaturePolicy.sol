// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {I1271Policy, I1271TypedDataPolicy} from "./interfaces/IPolicy.sol";
import {Conditions} from "./lib/Conditions.sol";
import {PolicyBase} from "./lib/PolicyBase.sol";

/// @title SignaturePolicy
/// @notice What a session key may sign with ERC-1271: which contracts may verify the signature (Permit2, a token's
/// `permit`) and, optionally, which typed data it may cover, down to conditions on single fields (a permit's spender
/// and value).
/// @dev `initData` is `abi.encode(Config)`, each of `types` being `abi.encode(TypedData)` (one level of nesting less
/// for the ABI decoder). The verifying contract must be in `verifiers`. When `types` is not empty, the signed struct
/// must also match one of them: its app domain separator and type hash, and every field rule.
/// A field rule compares field `index` of the struct's EIP-712 `encodeData` (the word after the type hash and
/// `index` fields) as an unsigned integer, like `ArgPolicy`: `Eq`, `Neq`, `Lt`, `Lte`, `Gt`, `Gte` against `refs[0]`,
/// `Between` with `refs[0] <= x <= refs[1]`, `OneOf` with `x` in `refs`. A dynamic or nested field's word is its
/// hash, so only `Eq`, `Neq` and `OneOf` are meaningful there.
///
/// Smart Sessions passes the signed typed data (`I1271TypedDataPolicy`) after checking it hashes to the signed
/// struct, so these conditions bind what the session key signed. Without typed data (an empty `contentsData`, or a
/// multiplexer that only calls `check1271SignedAction`), only a configuration without `types` can pass.
// slither-disable-next-line missing-inheritance
contract SignaturePolicy is PolicyBase, I1271TypedDataPolicy {
    struct Config {
        address[] verifiers;
        bytes[] types;
    }

    struct TypedData {
        bytes32 appDomainSeparator;
        bytes32 typeHash;
        FieldRule[] fields;
    }

    struct FieldRule {
        Conditions.Condition condition;
        uint256 index;
        bytes32[] refs;
    }

    error NoVerifiers();
    error InvalidFieldRule(uint256 typeIndex, uint256 ruleIndex);

    /// @inheritdoc I1271TypedDataPolicy
    function check1271TypedData(
        bytes32 id,
        address requestSender,
        address account,
        bytes32 appDomainSeparator,
        bytes calldata contentsData,
        bytes calldata
    ) external view returns (bool) {
        Config memory config = abi.decode(_config(id, account), (Config));
        if (!_isVerifier(config.verifiers, requestSender)) return false;

        uint256 length = config.types.length;
        if (length == 0) return true;
        if (contentsData.length < 32) return false;
        for (uint256 i; i < length; ++i) {
            TypedData memory typedData = abi.decode(config.types[i], (TypedData));
            if (_matches(typedData, appDomainSeparator, contentsData)) return true;
        }
        return false;
    }

    /// @inheritdoc I1271Policy
    function check1271SignedAction(
        bytes32 id,
        address requestSender,
        address account,
        bytes32,
        bytes calldata
    ) external view returns (bool) {
        Config memory config = abi.decode(_config(id, account), (Config));
        return config.types.length == 0 && _isVerifier(config.verifiers, requestSender);
    }

    function _supportsKind(bytes4 interfaceId) internal pure override returns (bool) {
        return interfaceId == type(I1271Policy).interfaceId
            || interfaceId == type(I1271TypedDataPolicy).interfaceId;
    }

    /// @dev Stores `initData` as is: ERC-1271 checks are views, outside the user operation's gas.
    function _pack(bytes calldata initData) internal pure override returns (bytes memory) {
        Config memory config = abi.decode(initData, (Config));
        if (config.verifiers.length == 0) revert NoVerifiers();
        uint256 typeCount = config.types.length;
        for (uint256 i; i < typeCount; ++i) {
            FieldRule[] memory fields = abi.decode(config.types[i], (TypedData)).fields;
            uint256 fieldCount = fields.length;
            for (uint256 j; j < fieldCount; ++j) {
                // An index this large would overflow the word's offset in `_matches`.
                if (
                    fields[j].index > type(uint32).max
                        || !Conditions.wellFormed(fields[j].condition, fields[j].refs)
                ) revert InvalidFieldRule(i, j);
            }
        }
        return initData;
    }

    function _isVerifier(address[] memory verifiers, address requestSender)
        private
        pure
        returns (bool)
    {
        uint256 length = verifiers.length;
        for (uint256 i; i < length; ++i) {
            if (verifiers[i] == requestSender) return true;
        }
        return false;
    }

    /// @dev Whether the signed struct is of `typedData`'s domain and type and meets all its field rules. A field
    /// past the end of `contentsData` fails its rule.
    function _matches(
        TypedData memory typedData,
        bytes32 appDomainSeparator,
        bytes calldata contentsData
    ) private pure returns (bool) {
        if (typedData.appDomainSeparator != appDomainSeparator) {
            return false;
        }
        if (typedData.typeHash != bytes32(contentsData[:32])) return false;

        uint256 length = typedData.fields.length;
        for (uint256 i; i < length; ++i) {
            FieldRule memory rule = typedData.fields[i];
            uint256 start = 32 + 32 * rule.index;
            if (contentsData.length < start + 32) return false;
            uint256 x = uint256(bytes32(contentsData[start:start + 32]));
            if (!Conditions.holds(rule.condition, rule.refs, x)) return false;
        }
        return true;
    }
}
