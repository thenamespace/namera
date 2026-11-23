// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.38;

import {ERC4337} from "solady/accounts/ERC4337.sol";

import {WebAuthnValidator} from "src/validators/WebAuthnValidator.sol";

import {WebAuthnTestBase} from "../../utils/WebAuthnTestBase.sol";

/// @notice Adds, removes and re-thresholds passkeys on two accounts, and after each step checks that a signature
/// from a passkey the account no longer holds, or from another account's passkey, never validates.
contract PasskeyHandler is WebAuthnTestBase {
    bytes32 internal constant USER_OP_HASH = keccak256("invariant user operation hash");
    uint256 internal constant POOL = 20;

    WebAuthnValidator public immutable validator;
    address[2] public accounts;
    TestPasskey[] internal pool;
    mapping(address account => mapping(uint256 index => bool)) public holds;

    bool public foreignSignatureAccepted;

    constructor(WebAuthnValidator validator_) {
        validator = validator_;
        accounts = [makeAddr("invariant account 0"), makeAddr("invariant account 1")];
        for (uint256 i; i < POOL; ++i) {
            pool.push(_passkey(string.concat("invariant passkey ", vm.toString(i))));
        }
        for (uint256 a; a < 2; ++a) {
            vm.prank(accounts[a]);
            validator.onInstall(_installData(1, _list(pool[a])));
            holds[accounts[a]][a] = true;
        }
    }

    function add(uint256 accountSeed, uint256 passkeySeed) external {
        address account = accounts[accountSeed % 2];
        uint256 index = passkeySeed % POOL;
        vm.prank(account);
        try validator.addPasskey(_config(pool[index])) {
            holds[account][index] = true;
        } catch {}
        _checkForeign(account, passkeySeed);
    }

    function remove(uint256 accountSeed, uint256 passkeySeed) external {
        address account = accounts[accountSeed % 2];
        uint256 index = passkeySeed % POOL;
        vm.prank(account);
        try validator.removePasskey(pool[index].id) {
            holds[account][index] = false;
        } catch {}
        _checkForeign(account, passkeySeed);
    }

    function setThreshold(uint256 accountSeed, uint256 threshold) external {
        address account = accounts[accountSeed % 2];
        vm.prank(account);
        try validator.setThreshold(bound(threshold, 0, 17)) {} catch {}
    }

    function passkeyAt(uint256 index) external view returns (TestPasskey memory) {
        return pool[index];
    }

    function _checkForeign(address account, uint256 seed) internal {
        uint256 index = (seed / POOL) % POOL;
        if (holds[account][index]) return;
        (uint256 threshold,,) = validator.getPasskeys(account);
        if (threshold != 1) return;

        ERC4337.PackedUserOperation memory userOp;
        userOp.sender = account;
        userOp.signature = _signature(BACKEND_SOLIDITY, _assert(pool[index], USER_OP_HASH));
        vm.prank(account);
        if (validator.validateUserOp(userOp, USER_OP_HASH) == 0) foreignSignatureAccepted = true;
    }
}
