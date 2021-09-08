//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./CoinBHO.sol";

contract CoinBHOV2 is CoinBHO, AccessControlUpgradeable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bool private _initialized_v2;

    function initialize_v2() public returns (bool) {
        require(!_initialized_v2, "CoinBHOV2: already initialized");
        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _initialized_v2 = true;
        return true;
    }

    function mint(address user, uint256 amount) public virtual returns (bool) {
        require(
            hasRole(MINTER_ROLE, _msgSender()),
            "CoinBHOV2: Sender with MINTER_ROLE is required"
        );
        _mint(user, amount);
        return true;
    }
}
