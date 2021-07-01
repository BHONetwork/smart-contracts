// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./TokenTimeLock.sol";
import "hardhat/console.sol";

contract TokenTimeLockProxyFactory is Ownable {
    using Address for address;

    event ProxyCreated(address proxy);

    function createProxy(
        address lock,
        address user_,
        address token_,
        uint256 amount_,
        uint32[] calldata lockDurations_,
        uint32[] calldata releasePercents_,
        uint64 startDate_
    ) public returns (address) {
        address proxy = Clones.clone(lock);
        bool setupResult = TokenTimeLock(proxy).setup(
            user_,
            token_,
            amount_,
            lockDurations_,
            releasePercents_,
            startDate_
        );
        require(setupResult, "TokenTimeLockProxy: can't setup");

        emit ProxyCreated(proxy);

        return proxy;
    }
}
